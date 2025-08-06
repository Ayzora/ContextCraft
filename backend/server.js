const express = require("express");
const cors = require("cors");
const fs = require("fs").promises;
const axios = require("axios");
const multer = require("multer");
const { error } = require("console");
const upload = multer({
  dest: "uploads/",
  fileFilter: (req, file, cb) => {
    // Allow only files with text-based MIME types
    const allowedMimeTypes = [
      "application/pdf", // PDFs
      "text/plain", // Plain text files
      "application/msword", // Word documents
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // Word (docx)
      //allow code files
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

require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

//--------------------- /chat endpoints ----------------------------
app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;
  if (!userMessage) {
    return res.status(404).json({ error: "Message is required" });
  }

  try {
    const response = await axios.post("http://localhost:11434/api/generate", {
      model: "llama3.1:8b",
      prompt: userMessage,
      stream: false,
    });
    const assitantMessage = response.data.response;

    //save both messages to chat log.json
    const logEntry = {
      user: userMessage,
      assistant: assitantMessage,
      timestamp: new Date().toISOString(),
    };
    saveTochatLog(logEntry);
    res.json({ response: assitantMessage });
  } catch (error) {
    console.error("Error generating response:", error);
    res.status(500).json({ error: "Failed to generate response" });
  }
});

// -------------  /upload endpoints ------------------------------------
app.post("/upload", upload.single("file"), async (req, res, next) => {
  try {
    const dataChunks = await saveFileContent(req.file.filename);

    for (let i = 0; i < dataChunks.length; i++) {
        createEmbedding(dataChunks[i])
        
      
    }

    console.log('FINISHED EMBEDDING ALL THE CHUNKS')
    res.status(200).send()
  } catch (err) {
    next(err);
  }
});

//functionss
function saveTochatLog(entry) {
  const logFile = "chatlog.json";
  let chatLog = [];

  // Read existing log if it exists
  if (fs.existsSync(logFile)) {
    const data = fs.readFileSync(logFile, "utf8");
    if (data) {
      try {
        chatLog = JSON.parse(data);
      } catch (e) {
        console.error("Error parsing chatlog.json:", e);
        chatLog = [];
      }
    }
  }

  // Add new entry and save
  chatLog.push(entry);
  fs.writeFileSync(logFile, JSON.stringify(chatLog, null, 2), "utf8");
}
 
async function saveFileContent(file) {
  try {
    const data = await fs.readFile(`uploads/${file}`, "utf8");

    let dataArray = data.split(" ");
    let dataChunks = [];
    let sliceStart = 0;

    if (dataArray.length < 500) {
      dataChunks.push(dataArray.join(" "));
      return dataChunks;
    }

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
    console.log("File uploaded and chunks returned")
    return dataChunks;
  } catch (err) {
    const error = new Error("File is unreadable or corrupted");
    error.status = 400; // Set a status code for the error
    throw error; // Throw the error to be caught by the error handler
  }
}

async function createEmbedding(chunk) {
  try {
    const response = await axios.post("http://localhost:5000/embed", {
      text: chunk,
    });
    console.log("Embed response:", response.data);
    const embedding = response.data.embedding;

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
    console.error("Error embedding the chunk:", err);
    err.message = "Error embedding the chunk";
    err.status = 500;
    throw err;
  }
};


app.use((err, req, res, next) => {
  console.error(err.stack);
  res
    .status(err.status || 500)
    .json({ error: err.message || "Internal Server Error" });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
