const form = document.getElementById("chat-form");
const chatbox = document.getElementById("chatbox");
const input = document.getElementById("message");
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  console.log("SUBMIT");
  const userMessage = input.value.trim();
  if (!userMessage) return;
  addMessage(userMessage, "user");
  input.value = "";
  try {
    const res = await fetch("http://localhost:3000/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userMessage }),
    });
    const data = await res.json();
    addMessage(data.response, "assistant");
  } catch (err) {
    addMessage("⚠️ Error: Could not connect to backend", "assistant");
  }
});
function addMessage(text, role) {
  const msg = document.createElement("div");
  msg.classList.add("message", role);
  msg.textContent = text;
  chatbox.appendChild(msg);
  chatbox.scrollTop = chatbox.scrollHeight;
}
