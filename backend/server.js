const express = require("express");
const cors = require("cors");
const fs = require("fs");
const axios = require("axios");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

//--------------------- /chat endpoints ---------------------------
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

//functions 
function saveTochatLog(entry){
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

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});