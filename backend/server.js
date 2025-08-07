// Import required modules
const express = require("express");
const cors = require("cors");
const multer = require("multer");
require("dotenv").config();
// Configure multer for file uploads
const upload = multer({ dest: "uploads/" });
// Import services
const {
  saveToChatLog,
  saveFileContent,
  getRecentChatHistory,
} = require("./services/fileService");

const {
  generateUserQueryEmbedding,
  createEmbedding,
  readVectorDatabase,
} = require("./services/embeddingService");
const { cosineSimilarity } = require("./services/mathHelpers");

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

//--------------------- /chat endpoint ----------------------------

/**
 * Chat endpoint to handle user messages and generate assistant responses
 */
app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;
  if (!userMessage) {
    return res.status(404).json({ error: "Message is required" });
  }

  try {
    const userMessageEmbedding = await generateUserQueryEmbedding(userMessage);
    const vectorData = await readVectorDatabase();

    // Rank chunks by similarity
    const rankedChunks = vectorData
      .map((item) => ({
        text: item.text,
        similarity: cosineSimilarity(userMessageEmbedding, item.embedding),
      }))
      .sort((a, b) => b.similarity - a.similarity);

    // Take top 3 results
    const topChunks = rankedChunks.slice(0, 3);
    const context = topChunks.map((c) => c.text).join("\n\n");

    const prompt = `
    You are an AI assistant. Use the following context to answer the user's question.

    Context:
    ${context}

    User: ${userMessage}
    Assistant:
    `;

    // Make API request to generate assistant response
    const response = await require("axios").post(
      "http://localhost:11434/api/generate",
      {
        model: "llama3.1:8b",
        prompt: prompt,
        stream: false,
      }
    );
    const assitantMessage = response.data.response;

    // Save both messages to chat log
    const logEntry = {
      user: userMessage,
      assistant: assitantMessage,
      timestamp: new Date().toISOString(),
    };
    await saveToChatLog(logEntry);
    res.json({ response: assitantMessage });
  } catch (error) {
    console.error("Error generating response:", error);
    res.status(500).json({ error: "Failed to generate response" });
  }
});

// -------------  /upload endpoint ------------------------------------

/**
 * Upload endpoint to handle file uploads and create embeddings
 */
app.post("/upload", upload.single("file"), async (req, res, next) => {
  try {
    const dataChunks = await saveFileContent(req.file.filename);
    for (let i = 0; i < dataChunks.length; i++) {
      await createEmbedding(dataChunks[i]);
    }
    console.log("FINISHED EMBEDDING ALL THE CHUNKS");
    res.status(200).send();
  } catch (err) {
    next(err);
  }
});

//--------------------- Error Handling ----------------------------

/**
 * Global error handler
 */
app.use((err, req, res, next) => {
  console.error(err.stack);
  res
    .status(err.status || 500)
    .json({ error: err.message || "Internal Server Error" });
});

//--------------------- Start Server ----------------------------

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});



// You are an AI assistant. Use the following context and recent conversation history to answer the user's question.

// Context:
// <--- vector-based top chunks --->

// Conversation History:
// User: ...
// Assistant: ...
// User: ...
// Assistant: ...

// Current Question:
// User: <userMessage>
// Assistant:
