// Import required modules
const express = require("express");
const cors = require("cors");
const fs = require("fs").promises; // Promises-based file system module
const axios = require("axios"); // HTTP client for making API requests
const multer = require("multer"); // Middleware for handling file uploads
const { error } = require("console"); // Console utility for logging errors

// Configure multer for file uploads
const upload = multer({
  dest: "uploads/", // Directory where uploaded files are stored
  fileFilter: (req, file, cb) => {
    // Allow only files with specific MIME types
    const allowedMimeTypes = [
      "application/pdf", // PDFs
      "text/plain", // Plain text files
      "application/msword", // Word documents
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // Word (docx)
      "text/x-python", // Python files
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true); // Accept the file
    } else {
      const error = new Error("Only text-based files are allowed");
      error.status = 400; // Set a status code for the error
      cb(error, false); // Reject the file
    }
  },
});

// Load environment variables from .env file
require("dotenv").config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000; // Use port from environment or default to 3000

// Middleware for handling CORS and JSON requests
app.use(cors());
app.use(express.json());

//--------------------- /chat endpoints ----------------------------

/**
 * Chat endpoint to handle user messages and generate assistant responses
 */
app.post("/chat", async (req, res) => {
  const userMessage = req.body.message; // Extract user message from request body
  if (!userMessage) {
    return res.status(404).json({ error: "Message is required" }); // Return error if message is missing
  }

  try {
    // Make API request to generate assistant response
    const response = await axios.post("http://localhost:11434/api/generate", {
      model: "llama3.1:8b", // Specify model
      prompt: userMessage, // Pass user message as prompt
      stream: false, // Disable streaming
    });
    const assitantMessage = response.data.response; // Extract assistant response

    // Save both messages to chat log
    const logEntry = {
      user: userMessage,
      assistant: assitantMessage,
      timestamp: new Date().toISOString(), // Add timestamp
    };
    saveTochatLog(logEntry); // Save log entry to chatlog.json
    res.json({ response: assitantMessage }); // Send assistant response to client
  } catch (error) {
    console.error("Error generating response:", error); // Log error
    res.status(500).json({ error: "Failed to generate response" }); // Return error response
  }
});

// -------------  /upload endpoints ------------------------------------

/**
 * Upload endpoint to handle file uploads and create embeddings
 */
app.post("/upload", upload.single("file"), async (req, res, next) => {
  try {
    const dataChunks = await saveFileContent(req.file.filename); // Split file content into chunks

    // Create embeddings for each chunk
    for (let i = 0; i < dataChunks.length; i++) {
      createEmbedding(dataChunks[i]);
    }

    console.log("FINISHED EMBEDDING ALL THE CHUNKS"); // Log completion
    res.status(200).send(); // Send success response
  } catch (err) {
    next(err); // Pass error to global error handler
  }
});

//--------------------- Utility Functions ----------------------------

/**
 * Save chat log entry to chatlog.json
 * @param {Object} entry - Chat log entry containing user and assistant messages
 */
function saveTochatLog(entry) {
  const logFile = "chatlog.json";
  let chatLog = [];

  // Read existing log if it exists
  if (fs.existsSync(logFile)) {
    const data = fs.readFileSync(logFile, "utf8");
    if (data) {
      try {
        chatLog = JSON.parse(data); // Parse existing log
      } catch (e) {
        console.error("Error parsing chatlog.json:", e); // Log error
        chatLog = []; // Initialize as empty array
      }
    }
  }

  // Add new entry and save
  chatLog.push(entry);
  fs.writeFileSync(logFile, JSON.stringify(chatLog, null, 2), "utf8"); // Write updated log
}

/**
 * Read and split file content into chunks
 * @param {string} file - Filename of the uploaded file
 * @returns {Array} - Array of text chunks
 */
async function saveFileContent(file) {
  try {
    const data = await fs.readFile(`uploads/${file}`, "utf8"); // Read file content

    let dataArray = data.split(" "); // Split content into words
    let dataChunks = [];
    let sliceStart = 0;

    // Handle small files
    if (dataArray.length < 500) {
      dataChunks.push(dataArray.join(" "));
      return dataChunks;
    }

    // Split content into chunks of 500 words
    for (let i = 0; i < dataArray.length; i++) {
      if (i % 500 === 0 && i !== 0) {
        let chunk = dataArray.slice(sliceStart, i);
        dataChunks.push(chunk.join(" "));
        sliceStart = i;
      }
    }

    // Add the remaining words as the final chunk
    if (sliceStart < dataArray.length) {
      const finalChunk = dataArray.slice(sliceStart);
      dataChunks.push(finalChunk.join(" "));
    }
    console.log("File uploaded and chunks returned");
    return dataChunks; // Return chunks
  } catch (err) {
    const error = new Error("File is unreadable or corrupted");
    error.status = 400; // Set a status code for the error
    throw error; // Throw the error to be caught by the error handler
  }
}

/**
 * Create embedding for a text chunk and save to vectors.json
 * @param {string} chunk - Text chunk to embed
 */
async function createEmbedding(chunk) {
  try {
    const response = await axios.post("http://localhost:5000/embed", {
      text: chunk, // Pass chunk as text
    });
    console.log("Embed response:", response.data); // Log response
    const embedding = response.data.embedding; // Extract embedding

    const vectorData = { text: chunk, embedding: embedding };

    // Read existing vectors.json content
    let existingData = [];
    try {
      const fileContent = await fs.readFile("vectors.json", "utf8");
      existingData = JSON.parse(fileContent); // Parse existing JSON content
    } catch (err) {
      console.warn("vectors.json not found or invalid, initializing as an empty array.");
      existingData = []; // Initialize as an empty array
    }

    // Append new vector data
    existingData.push(vectorData);

    // Write updated content back to vectors.json
    await fs.writeFile("vectors.json", JSON.stringify(existingData, null, 2), "utf8");
    console.log("Vector data appended successfully");
  } catch (err) {
    console.error("Error embedding the chunk:", err); // Log error
    err.message = "Error embedding the chunk";
    err.status = 500;
    throw err; // Throw error to be caught by the error handler
  }
}

//--------------------- Error Handling ----------------------------

/**
 * Global error handler
 */
app.use((err, req, res, next) => {
  console.error(err.stack); // Log error stack
  res
    .status(err.status || 500) // Use error status or default to 500
    .json({ error: err.message || "Internal Server Error" }); // Send error response
});

//--------------------- Start Server ----------------------------

/**
 * Start the server
 */
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`); // Log server start
});
