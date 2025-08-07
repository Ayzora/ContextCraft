const { readFile, writeFile } = require("fs").promises;
const fs = require("fs");

/**
 * Save chat log entry to chatlog.json
 * @param {Object} entry - Chat log entry containing user and assistant messages
 */
async function saveToChatLog(entry) {
  const logFile = "chatlog.json";
  let chatLog = [];

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

  chatLog.push(entry);
  await writeFile(logFile, JSON.stringify(chatLog, null, 2), "utf8");
}

/**
 * Read and split file content into chunks
 * @param {string} file - Filename of the uploaded file
 * @returns {Array} - Array of text chunks
 */
async function saveFileContent(file) {
  try {
    const data = await readFile(`uploads/${file}`, "utf8");

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

    if (sliceStart < dataArray.length) {
      const finalChunk = dataArray.slice(sliceStart);
      dataChunks.push(finalChunk.join(" "));
    }
    console.log("File uploaded and chunks returned");
    return dataChunks;
  } catch (err) {
    const error = new Error("File is unreadable or corrupted");
    error.status = 400;
    throw error;
  }
}

async function getRecentChatHistory(limit = 10) {
  try {
    const logFile = JSON.parse(
      await readFile("./backend/chatlog.json", "utf-8")
    );
    const recent = logFile.slice(-limit);
    return recent
      .map((entry) => `User: ${entry.user}\nAssistant: ${entry.assistant}`)
      .join("\n\n");
  } catch (err) {
    console.warn("No chat history found");
    return "";
  }
}

module.exports = {
  saveToChatLog,
  saveFileContent,
  getRecentChatHistory,
};
