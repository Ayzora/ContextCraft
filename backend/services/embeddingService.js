const axios = require('axios');
const { readFile, writeFile } = require('fs').promises;

/**
 * Generate embedding for user query
 * @param {string} query - User's query text
 * @returns {Array} - Embedding vector
 */
async function generateUserQueryEmbedding(query) {
  try {
    const response = await axios.post("http://localhost:5000/embed", {
      text: query,
    });
    return response.data.embedding;
  } catch (err) {
    console.error("Error embedding user query:", err);
    throw Object.assign(new Error("Could not create user query"), {
      status: 500,
    });
  }
}

/**
 * Create embedding for a text chunk and save to vectors.json
 * @param {string} chunk - Text chunk to embed
 */
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
      const fileContent = await readFile("vectors.json", "utf8");
      existingData = JSON.parse(fileContent);
    } catch (err) {
      console.warn(
        "vectors.json not found or invalid, initializing as an empty array."
      );
      existingData = [];
    }

    existingData.push(vectorData);
    await writeFile(
      "vectors.json",
      JSON.stringify(existingData, null, 2),
      "utf8"
    );
    console.log("Vector data appended successfully");
  } catch (err) {
    console.error("Error embedding the chunk:", err);
    err.message = "Error embedding the chunk";
    err.status = 500;
    throw err;
  }
}

/**
 * Read vector database
 * @returns {Array} - Array of vector data
 */
async function readVectorDatabase() {
  try {
    const vectorDataContent = await readFile("vectors.json", "utf-8");
    return JSON.parse(vectorDataContent);
  } catch (err) {
    console.warn("data does not exist");
    return [];
  }
}

module.exports = {
  generateUserQueryEmbedding,
  createEmbedding,
  readVectorDatabase
};