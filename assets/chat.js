/* =========================================================
   AI College-Life Planning Assistant — chat frontend
   Talks ONLY to our own backend endpoint, never to Zhipu
   directly, so no API key exists in the browser.
   ========================================================= */

(function () {
  var form = document.getElementById("chatForm");
  var input = document.getElementById("chatInput");
  var sendBtn = document.getElementById("chatSend");
  var log = document.getElementById("chatLog");
  var hint = document.getElementById("chatHint");

  if (!form || !input || !log) return;

  // Conversation history kept for the current visit only.
  var history = [];
  var waiting = false;

  var ENDPOINT = "/.netlify/functions/chat";

  function addMessage(role, text) {
    var msg = document.createElement("div");
    msg.className = "chat-msg " + (role === "user" ? "chat-msg-user" : "chat-msg-bot");
    msg.textContent = text;
    log.appendChild(msg);
    log.scrollTop = log.scrollHeight;
    return msg;
  }

  function setWaiting(state) {
    waiting = state;
    sendBtn.disabled = state;
    sendBtn.textContent = state ? "Sending…" : "Send";
  }

  async function askQuestion(question) {
    addMessage("user", question);
    history.push({ role: "user", content: question });
    setWaiting(true);

    var bubble = addMessage("assistant", "Thinking…");
    bubble.classList.add("is-loading");

    try {
      var res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.slice(-10) })
      });

      var data = await res.json().catch(function () { return null; });

      if (!res.ok || !data || !data.reply) {
        bubble.textContent =
          (data && data.error) ||
          "Something went wrong — please try again in a moment.";
        // Remove the unanswered question so it isn't sent again next turn.
        history.pop();
        return;
      }

      bubble.classList.remove("is-loading");
      bubble.textContent = data.reply;
      history.push({ role: "assistant", content: data.reply });
    } catch (networkError) {
      bubble.textContent = "Could not connect — check your internet and try again.";
      history.pop();
    } finally {
      log.scrollTop = log.scrollHeight;
      setWaiting(false);
      input.focus();
    }
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (waiting) return;

    var question = input.value.trim();
    if (!question) {
      hint.textContent = "Please type a question first.";
      input.focus();
      return;
    }
    hint.textContent = "Tip: press Ctrl + Enter to send.";
    input.value = "";
    askQuestion(question);
  });

  // Ctrl/Cmd + Enter sends; a plain Enter just starts a new line.
  input.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event("submit"));
    }
  });
})();
