// Configuration & Defaults
const DEFAULT_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjdjODlhMTFjLWNlMjgtNGI0Ny05ODg4LTExN2Q2ZWYxOTQwMiIsImxhc3RfcGFzc3dvcmRfY2hhbmdlIjoxNzg0NjM2ODE4LCJleHAiOjE3ODg1NzU5MTd9.sdSu1aXcLei_BWEMGyPNHWfpBv-eHR62Pj35wS-o1dc";
const DEFAULT_ENDPOINT = "https://qwen.aikit.club/v1/chat/completions";
const DEFAULT_MODEL = "qwen3.5-flash";

// State
let config = {
  endpoint: localStorage.getItem("qwen_endpoint") || DEFAULT_ENDPOINT,
  token: localStorage.getItem("qwen_token") || DEFAULT_TOKEN,
  model: localStorage.getItem("qwen_model") || DEFAULT_MODEL
};

let gameState = {
  mode: null, // 'ai-guesses', 'user-guesses', 'clue-guesser'
  category: '',
  questionCount: 0,
  maxQuestions: 20,
  history: [], // [{role: 'user'|'assistant', content: ''}]
  log: [], // [{q: '', a: ''}]
  aiSecretItem: '',
  isFinished: false
};

// DOM Elements
const views = {
  modeSelect: document.getElementById("mode-select-view"),
  setup: document.getElementById("setup-view"),
  game: document.getElementById("game-view"),
  clue: document.getElementById("clue-view"),
  end: document.getElementById("end-view")
};

const elements = {
  aiMessage: document.getElementById("ai-message"),
  questionCountBadge: document.getElementById("question-count"),
  modeBadge: document.getElementById("game-mode-label"),
  mindReaderControls: document.getElementById("mind-reader-controls"),
  secretKeeperControls: document.getElementById("secret-keeper-controls"),
  aiGuessBox: document.getElementById("ai-guess-box"),
  aiGuessTitle: document.getElementById("ai-guess-title"),
  aiGuessDesc: document.getElementById("ai-guess-desc"),
  historyLog: document.getElementById("history-log"),
  logCount: document.getElementById("log-count"),
  userInputText: document.getElementById("user-input-text"),
  userQuestionForm: document.getElementById("user-question-form"),
  
  // Settings modal
  settingsBtn: document.getElementById("settings-btn"),
  settingsModal: document.getElementById("settings-modal"),
  closeModalBtn: document.getElementById("close-modal"),
  saveSettingsBtn: document.getElementById("save-settings"),
  apiEndpointInput: document.getElementById("api-endpoint"),
  apiTokenInput: document.getElementById("api-token"),
  apiModelSelect: document.getElementById("api-model")
};

// Initialize App
document.addEventListener("DOMContentLoaded", () => {
  initSettings();
  bindEvents();
});

function initSettings() {
  elements.apiEndpointInput.value = config.endpoint;
  elements.apiTokenInput.value = config.token === DEFAULT_TOKEN ? "" : config.token;
  elements.apiModelSelect.value = config.model;
}

function bindEvents() {
  // Navigation & Mode selection
  document.querySelectorAll(".mode-card").forEach(card => {
    card.addEventListener("click", () => selectMode(card.dataset.mode));
  });

  document.querySelectorAll(".btn-back").forEach(btn => {
    btn.addEventListener("click", () => switchView("modeSelect"));
  });

  // Category selection
  document.querySelectorAll(".cat-btn").forEach(btn => {
    btn.addEventListener("click", () => startMindReaderGame(btn.dataset.cat));
  });

  // Mind Reader answers
  document.querySelectorAll(".btn-ans").forEach(btn => {
    btn.addEventListener("click", () => handleUserAnswer(btn.dataset.ans));
  });

  // Secret Keeper form
  elements.userQuestionForm.addEventListener("submit", (e) => {
    e.preventDefault();
    handleSecretKeeperQuestion(elements.userInputText.value.trim());
    elements.userInputText.value = "";
  });

  // Guess Box buttons
  document.getElementById("guess-yes").addEventListener("click", () => finishGame(true, "AI guessed it correctly!"));
  document.getElementById("guess-no").addEventListener("click", () => handleWrongGuess());

  // Clue Form
  document.getElementById("clue-form").addEventListener("submit", (e) => {
    e.preventDefault();
    handleClueGuesser();
  });

  // Play Again
  document.getElementById("play-again-btn").addEventListener("click", () => switchView("modeSelect"));

  // Settings modal
  elements.settingsBtn.addEventListener("click", () => elements.settingsModal.classList.add("active"));
  elements.closeModalBtn.addEventListener("click", () => elements.settingsModal.classList.remove("active"));
  elements.saveSettingsBtn.addEventListener("click", saveSettings);
}

function saveSettings() {
  config.endpoint = elements.apiEndpointInput.value.trim() || DEFAULT_ENDPOINT;
  config.token = elements.apiTokenInput.value.trim() || DEFAULT_TOKEN;
  config.model = elements.apiModelSelect.value;

  localStorage.setItem("qwen_endpoint", config.endpoint);
  localStorage.setItem("qwen_token", config.token);
  localStorage.setItem("qwen_model", config.model);

  elements.settingsModal.classList.remove("active");
  alert("Settings saved!");
}

function switchView(viewName) {
  Object.values(views).forEach(v => v.classList.remove("active"));
  views[viewName].classList.add("active");
}

// ----------------------------------------------------
// Mode 1: Mind Reader (AI Guesses User's Secret)
// ----------------------------------------------------
function selectMode(mode) {
  gameState.mode = mode;
  if (mode === "ai-guesses") {
    switchView("setup");
  } else if (mode === "user-guesses") {
    startSecretKeeperGame();
  } else if (mode === "clue-guesser") {
    switchView("clue");
  }
}

async function startMindReaderGame(category) {
  gameState.category = category;
  gameState.questionCount = 1;
  gameState.history = [];
  gameState.log = [];
  gameState.isFinished = false;

  elements.modeBadge.textContent = "Mind Reader";
  elements.questionCountBadge.textContent = `Question 1/${gameState.maxQuestions}`;
  elements.mindReaderControls.classList.remove("hidden");
  elements.secretKeeperControls.classList.add("hidden");
  elements.aiGuessBox.classList.add("hidden");
  updateLogDisplay();

  switchView("game");
  elements.aiMessage.textContent = "🧙‍♂️ Channeling the cosmic AI forces... Thinking of your first question...";

  const systemPrompt = `You are Akinator, a master mind reader AI. The user is thinking of something in the category: "${category}".
Your goal is to guess what the user is thinking of within 20 questions.
Rules:
1. Ask one sharp, clever yes/no question at a time to narrow down the target.
2. If you are 80%+ confident you know the exact answer, output your guess in this format:
GUESS: <Item Name>
Reasoning: <Short 1-sentence clue why you think so>
3. Otherwise, just output your single question directly without extra conversational filler.`;

  gameState.history = [
    { role: "system", content: systemPrompt },
    { role: "user", content: "I have picked my secret item. Ask your first question!" }
  ];

  await fetchNextAiAction();
}

async function handleUserAnswer(answer) {
  if (gameState.isFinished) return;

  const lastQuestion = gameState.history[gameState.history.length - 1].content;
  gameState.log.push({ q: lastQuestion, a: answer });
  updateLogDisplay();

  gameState.history.push({ role: "user", content: `My answer is: ${answer}` });
  gameState.questionCount++;

  if (gameState.questionCount > gameState.maxQuestions) {
    // Force final guess
    gameState.history.push({ role: "user", content: "You reached 20 questions! Make your single best final guess right now using GUESS: <Item Name>." });
  }

  elements.questionCountBadge.textContent = `Question ${Math.min(gameState.questionCount, 20)}/${gameState.maxQuestions}`;
  elements.aiMessage.textContent = "🤔 Processing your answer...";

  await fetchNextAiAction();
}

async function fetchNextAiAction() {
  try {
    const aiResponse = await callQwenApi(gameState.history);
    gameState.history.push({ role: "assistant", content: aiResponse });

    if (aiResponse.includes("GUESS:")) {
      const match = aiResponse.match(/GUESS:\s*([^\n]+)/i);
      const guessTitle = match ? match[1].trim() : "Unknown Item";
      const descMatch = aiResponse.match(/Reasoning:\s*([^\n]+)/i);
      const guessDesc = descMatch ? descMatch[1].trim() : "Are you thinking of this?";

      elements.aiGuessTitle.textContent = guessTitle;
      elements.aiGuessDesc.textContent = guessDesc;
      elements.aiGuessBox.classList.remove("hidden");
      elements.aiMessage.textContent = "🔮 I am ready to make my prediction!";
    } else {
      elements.aiGuessBox.classList.add("hidden");
      elements.aiMessage.textContent = aiResponse;
    }
  } catch (err) {
    elements.aiMessage.textContent = `⚠️ Error connecting to Qwen API: ${err.message}. Please check your API Settings.`;
  }
}

function handleWrongGuess() {
  elements.aiGuessBox.classList.add("hidden");
  if (gameState.questionCount >= gameState.maxQuestions) {
    finishGame(false, "AI ran out of questions! You win!");
  } else {
    gameState.history.push({ role: "user", content: "That guess was wrong! Please ask another question to keep narrowing down." });
    fetchNextAiAction();
  }
}

// ----------------------------------------------------
// Mode 2: Secret Keeper (User Guesses AI's Secret)
// ----------------------------------------------------
async function startSecretKeeperGame() {
  gameState.category = "Anything";
  gameState.questionCount = 1;
  gameState.history = [];
  gameState.log = [];
  gameState.isFinished = false;

  elements.modeBadge.textContent = "Secret Keeper";
  elements.questionCountBadge.textContent = `Question 1/${gameState.maxQuestions}`;
  elements.mindReaderControls.classList.add("hidden");
  elements.secretKeeperControls.classList.remove("hidden");
  elements.aiGuessBox.classList.add("hidden");
  updateLogDisplay();

  switchView("game");
  elements.aiMessage.textContent = "🕵️ Picking a secret item from universe... Hold on!";

  const systemPrompt = `You are a Secret Keeper game host. 
1. Pick a well-known secret object, animal, character, or place.
2. In your first message, confirm you have picked a secret item and reveal ONLY its broad category (e.g. "I am thinking of a famous fictional character").
3. As the user asks Yes/No questions or makes guesses, answer honestly with "Yes", "No", "Partially", or "Close!".
4. If the user guesses the item correctly, reply with "CORRECT! You solved it! The secret item was indeed [item name]."`;

  gameState.history = [
    { role: "system", content: systemPrompt },
    { role: "user", content: "Pick a secret item and let's play!" }
  ];

  await fetchNextAiActionSecretKeeper();
}

async function handleSecretKeeperQuestion(questionText) {
  if (!questionText || gameState.isFinished) return;

  gameState.log.push({ q: questionText, a: "..." });
  updateLogDisplay();

  gameState.history.push({ role: "user", content: questionText });
  gameState.questionCount++;
  elements.questionCountBadge.textContent = `Question ${Math.min(gameState.questionCount, 20)}/${gameState.maxQuestions}`;
  elements.aiMessage.textContent = "Thinking...";

  await fetchNextAiActionSecretKeeper();
}

async function fetchNextAiActionSecretKeeper() {
  try {
    const aiResponse = await callQwenApi(gameState.history);
    gameState.history.push({ role: "assistant", content: aiResponse });

    elements.aiMessage.textContent = aiResponse;

    if (gameState.log.length > 0 && gameState.log[gameState.log.length - 1].a === "...") {
      gameState.log[gameState.log.length - 1].a = aiResponse;
      updateLogDisplay();
    }

    if (aiResponse.includes("CORRECT!")) {
      setTimeout(() => finishGame(true, "Congratulations! You guessed the AI's secret item!"), 1500);
    }
  } catch (err) {
    elements.aiMessage.textContent = `⚠️ Error: ${err.message}`;
  }
}

// ----------------------------------------------------
// Mode 3: Speed Clues
// ----------------------------------------------------
async function handleClueGuesser() {
  const c1 = document.getElementById("clue-1").value.trim();
  const c2 = document.getElementById("clue-2").value.trim();
  const c3 = document.getElementById("clue-3").value.trim();

  const resultCard = document.getElementById("clue-result");
  const loader = document.getElementById("clue-loader");
  const content = document.getElementById("clue-content");

  resultCard.classList.remove("hidden");
  loader.classList.remove("hidden");
  content.innerHTML = "";

  const messages = [
    { role: "system", content: "You are an expert clue solver. Analyze the 3 clues given by the user and guess the exact object, person, place, or concept." },
    { role: "user", content: `Here are 3 clues:\n1. ${c1}\n2. ${c2}\n3. ${c3}\nWhat am I thinking of? Format output with 🎯 Guess, 💡 Explanation, and ⭐ Confidence %.` }
  ];

  try {
    const response = await callQwenApi(messages);
    loader.classList.add("hidden");
    content.innerHTML = `<div style="line-height:1.6; font-size:1.05rem;">${response.replace(/\n/g, '<br>')}</div>`;
  } catch (err) {
    loader.classList.add("hidden");
    content.innerHTML = `<p style="color:var(--danger)">Error: ${err.message}</p>`;
  }
}

// ----------------------------------------------------
// Helper Functions & API Call
// ----------------------------------------------------
async function callQwenApi(messages) {
  const token = config.token || DEFAULT_TOKEN;

  const headers = {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  };

  const body = {
    model: config.model,
    messages: messages,
    stream: true,
    temperature: 0.7
  };

  const res = await fetch(config.endpoint, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API Error (${res.status}): ${errText || res.statusText}`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const data = await res.json();
    if (data.choices && data.choices[0] && data.choices[0].message) {
      return data.choices[0].message.content;
    }
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop();

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("data: ")) {
        const dataStr = trimmed.substring(6).trim();
        if (dataStr === "[DONE]") continue;
        try {
          const json = JSON.parse(dataStr);
          const choice = json.choices && json.choices[0];
          if (choice) {
            const content = (choice.delta && choice.delta.content) || (choice.message && choice.message.content) || "";
            fullText += content;
          }
        } catch (e) {
          // ignore partial JSON parse errors
        }
      }
    }
  }

  if (buffer.trim().startsWith("data: ")) {
    const dataStr = buffer.trim().substring(6).trim();
    if (dataStr !== "[DONE]") {
      try {
        const json = JSON.parse(dataStr);
        const choice = json.choices && json.choices[0];
        if (choice) {
          const content = (choice.delta && choice.delta.content) || (choice.message && choice.message.content) || "";
          fullText += content;
        }
      } catch (e) {}
    }
  }

  if (!fullText) {
    throw new Error("Empty response received from Qwen proxy.");
  }

  return fullText;
}

function updateLogDisplay() {
  elements.logCount.textContent = gameState.log.length;
  elements.historyLog.innerHTML = gameState.log.map((item, idx) => `
    <div class="log-item">
      <span><strong>Q${idx + 1}:</strong> ${escapeHtml(item.q)}</span>
      <span style="color:var(--primary)">${escapeHtml(item.a)}</span>
    </div>
  `).join('');
}

function finishGame(isWinner, message) {
  gameState.isFinished = true;
  document.getElementById("end-title").textContent = isWinner ? "🎉 VICTORY!" : "😅 NICE TRY!";
  document.getElementById("end-message").textContent = message;
  document.getElementById("end-icon").textContent = isWinner ? "👑" : "🤖";
  switchView("end");
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
