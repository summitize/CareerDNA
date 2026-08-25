import { generateResult } from "./scoring.js";
import {
  fetchAuthConfig,
  getSession,
  signInWithGoogle,
  saveMobileNumber,
  saveThemePreference,
  logout,
} from "./auth.js";

const state = {
  assessment: null,
  assessmentVersion: "6",
  // Versions the signed-in student may choose from. New takers only ever see
  // V6; students who started V4/V5 earlier also get those back.
  availableVersions: ["6"],
  questions: [],
  user: null,
  student: null,
  answers: {},
  currentIndex: 0,
  startedAt: null,
  latestResult: null,
  hasUnsavedChanges: false,
  saveMessage: "",
  previousView: "welcome",
  view: "loading",
};

const main = document.getElementById("main");
const progressBar = document.getElementById("progress-bar");
const progressFill = document.getElementById("progress-fill");
const progressLabel = document.getElementById("progress-label");
const userMenu = document.getElementById("user-menu");
const themeSlider = document.getElementById("theme-slider");
const themeSliderLabel = document.getElementById("theme-slider-label");
const contactButton = document.getElementById("contact-btn");
const whatsNewButton = document.getElementById("whatsnew-btn");

const THEMES = [
  { id: "light", name: "Day ☀️" },
  { id: "theme-sunset", name: "Sunset 🌅" },
  { id: "theme-rose", name: "Light Pink 🌸" },
  { id: "theme-sky", name: "Light Blue 🌊" },
  { id: "theme-cyberpunk", name: "Neon ⚡" },
  { id: "theme-emerald", name: "Emerald 🌿" },
  { id: "theme-sapphire", name: "Sapphire 🌌" },
  { id: "dark", name: "Night 🌙" },
];

function applyTheme(themeId) {
  const themeIndex = Math.max(0, THEMES.findIndex(t => t.id === themeId));
  const theme = THEMES[themeIndex] || THEMES[0];

  // Clear existing theme classes
  THEMES.forEach(t => {
    if (t.id !== "light") document.documentElement.classList.remove(t.id);
  });

  if (theme.id !== "light") {
    document.documentElement.classList.add(theme.id);
  }

  if (themeSlider) themeSlider.value = themeIndex;
  if (themeSliderLabel) themeSliderLabel.textContent = theme.name;
  localStorage.setItem("careerdna-theme", theme.id);
}

const savedTheme = localStorage.getItem("careerdna-theme") || "light";
applyTheme(savedTheme);

if (themeSlider) {
  themeSlider.oninput = (e) => {
    const selectedTheme = THEMES[parseInt(e.target.value, 10)] || THEMES[0];
    applyTheme(selectedTheme.id);
    queueThemeSync(selectedTheme.id);
  };
}

// Persist the theme against the signed-in user (debounced so dragging the
// slider does not spam the API). localStorage already covers anonymous users.
let themeSyncTimer = null;
function queueThemeSync(themeId) {
  if (!state.user) return;
  clearTimeout(themeSyncTimer);
  themeSyncTimer = setTimeout(() => {
    saveThemePreference(themeId).catch(() => {
      // Keep the local preference even if the server sync fails; it will be
      // retried the next time the slider moves.
    });
  }, 600);
}

// ---------------------------------------------------------------------------
// Retro "old times" tooltip popout: after sign-in, nudge the student to
// personalise their theme with the slider in the footer. Shown once per user
// per browser; closed via the cross button, Escape, or by using the slider.
// ---------------------------------------------------------------------------
const THEME_TIP_SEEN_KEY = "careerdna-theme-tip-seen";
let themeTipEl = null;

function themeTipStorageKey() {
  return `${THEME_TIP_SEEN_KEY}:${state.user?.email || "anon"}`;
}

function hasSeenThemeTip() {
  try {
    return localStorage.getItem(themeTipStorageKey()) === "1";
  } catch {
    return false;
  }
}

function markThemeTipSeen() {
  try {
    localStorage.setItem(themeTipStorageKey(), "1");
  } catch {
    // localStorage unavailable (private mode) — the tip just reappears next time.
  }
}

function positionThemeTip() {
  if (!themeTipEl || !themeSlider) return;
  const anchor = themeSlider.closest(".theme-slider-container");
  if (!anchor) return;
  const rect = anchor.getBoundingClientRect();
  const tipRect = themeTipEl.getBoundingClientRect();

  let left = rect.left + rect.width / 2 - tipRect.width / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - tipRect.width - 8));

  let top = rect.top - tipRect.height - 14; // leave room for the arrow
  themeTipEl.classList.remove("below");
  if (top < 8) {
    // Not enough room above — flip the bubble below the slider instead.
    top = rect.bottom + 14;
    themeTipEl.classList.add("below");
  }

  themeTipEl.style.left = `${Math.round(left)}px`;
  themeTipEl.style.top = `${Math.round(top)}px`;
}

function dismissThemeTip(markSeen = true) {
  if (!themeTipEl) return;
  const el = themeTipEl;
  themeTipEl = null;
  window.removeEventListener("resize", positionThemeTip);
  window.removeEventListener("scroll", positionThemeTip, true);
  document.removeEventListener("keydown", onThemeTipKeydown);
  el.remove();
  if (markSeen) markThemeTipSeen();
}

function onThemeTipKeydown(e) {
  if (e.key === "Escape") dismissThemeTip();
}

function showThemeTip() {
  if (!state.user || hasSeenThemeTip() || !themeSlider || themeTipEl) return;

  themeTipEl = document.createElement("div");
  themeTipEl.className = "theme-tip";
  themeTipEl.setAttribute("role", "status");
  themeTipEl.innerHTML = `
    <button type="button" class="theme-tip-close" aria-label="Close">&times;</button>
    <div class="theme-tip-head">
      <span class="theme-tip-icon">🎨</span>
      <span class="theme-tip-title">Personalise your theme!</span>
    </div>
    Welcome${state.user?.firstName ? `, ${escapeHtml(state.user.firstName)}` : ""}! Drag the
    <strong>theme slider</strong> at the bottom of the page to switch from bright Day ☀️
    all the way to deep Night 🌙. Your pick is remembered automatically.
    <div class="theme-tip-hint">Give it a slide &darr;</div>
  `;
  document.body.appendChild(themeTipEl);

  window.addEventListener("resize", positionThemeTip);
  window.addEventListener("scroll", positionThemeTip, true);
  document.addEventListener("keydown", onThemeTipKeydown);
  themeTipEl.querySelector(".theme-tip-close").onclick = () => dismissThemeTip();

  // Actually trying the slider counts as personalising — retire the tip.
  themeSlider.addEventListener(
    "input",
    () => dismissThemeTip(),
    { once: true },
  );

  positionThemeTip();
}

// ---------------------------------------------------------------------------
// "Dna" 🧬 — the CareerDNA voice assistant. Reads the question shown on the
// screen aloud (Web Speech synthesis) and collects answers by listening to
// the student (Web Speech recognition), mapping spoken replies onto the
// options visible on screen. Degrades gracefully when a browser lacks the
// Web Speech APIs.
// ---------------------------------------------------------------------------
const DNA_AUTO_READ_KEY = "careerdna-dna-autoread";
const DNA_NUMBER_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, first: 1, second: 2, third: 3, fourth: 4, fifth: 5,
  sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
};
const voiceState = {
  ttsOk: typeof window !== "undefined" && "speechSynthesis" in window,
  sttOk: typeof window !== "undefined" && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
  open: false,
  mode: "idle", // idle | speaking | listening
  interim: "",
  recognition: null,
};
let assistantFab = null;
let assistantPanel = null;
let dnaLastAutoReadKey = "";
let dnaSyncTimer = null;

function dnaAutoReadEnabled() {
  try {
    return localStorage.getItem(DNA_AUTO_READ_KEY) === "1";
  } catch {
    return false;
  }
}

function setDnaAutoRead(enabled) {
  try {
    localStorage.setItem(DNA_AUTO_READ_KEY, enabled ? "1" : "0");
  } catch {
    // localStorage unavailable — the toggle just won't persist.
  }
}

function currentAssistantQuestion() {
  if (state.view !== "question") return null;
  return state.questions[state.currentIndex] || null;
}

function ensureAssistantDom() {
  if (assistantFab) return;

  assistantFab = document.createElement("button");
  assistantFab.type = "button";
  assistantFab.className = "dna-fab hidden";
  assistantFab.setAttribute("aria-label", "Toggle Dna, the voice assistant");
  assistantFab.textContent = "🧬";
  assistantFab.onclick = () => {
    voiceState.open = !voiceState.open;
    updateAssistantPanel();
  };

  assistantPanel = document.createElement("section");
  assistantPanel.className = "dna-panel hidden";
  assistantPanel.setAttribute("aria-live", "polite");
  assistantPanel.innerHTML = `
    <header class="dna-head">
      <span class="dna-avatar">🧬</span>
      <div class="dna-name"><strong>Dna</strong><small>Your career buddy</small></div>
      <button type="button" class="dna-close" data-dna="close" aria-label="Close assistant">&times;</button>
    </header>
    <div class="dna-body">
      <div class="dna-msg" id="dna-msg"></div>
      <div class="dna-controls">
        <button type="button" class="dna-btn" data-dna="read" id="dna-read-btn">🔊 Read question</button>
        <button type="button" class="dna-btn" data-dna="mic" id="dna-mic-btn">🎤 Speak answer</button>
        <label class="dna-auto"><input type="checkbox" id="dna-auto" /> Auto-read</label>
      </div>
      <p class="dna-note">Try saying &ldquo;option 3&rdquo;, &ldquo;strongly agree&rdquo;, or &ldquo;next&rdquo;.</p>
    </div>
  `;
  document.body.append(assistantFab, assistantPanel);

  assistantPanel.addEventListener("click", (event) => {
    const action = event.target.closest("[data-dna]")?.dataset.dna;
    if (action === "close") {
      voiceState.open = false;
      updateAssistantPanel();
    } else if (action === "read") {
      readQuestionAloud();
    } else if (action === "mic") {
      toggleAssistantMic();
    }
  });
  assistantPanel.addEventListener("change", (event) => {
    if (event.target.id === "dna-auto") setDnaAutoRead(event.target.checked);
  });
}

function dnaDefaultMessage() {
  if (!voiceState.ttsOk && !voiceState.sttOk) {
    return "My voice and ears need Chrome or Edge — you can still answer by tapping the options.";
  }
  const question = currentAssistantQuestion();
  if (!question) {
    return "Start the assessment and I will read every question aloud and take your answers by voice.";
  }
  if (isRanking(question.questionType)) {
    return "This one needs the arrow buttons — but I can read it aloud for you!";
  }
  return 'Tap <strong>Read question</strong> to hear it, or <strong>Speak answer</strong> and tell me your choice.';
}

function dnaMessageHtml() {
  if (voiceState.mode === "listening") {
    return `<span class="dna-mic-rec">● Listening… speak now</span><br /><span class="dna-transcript">${escapeHtml(voiceState.interim || "…")}</span>`;
  }
  if (voiceState.mode === "speaking") {
    return '<span class="dna-status"><span class="dna-eq"><span></span><span></span><span></span><span></span></span> Speaking…</span>';
  }
  return dnaDefaultMessage();
}

function updateAssistantPanel() {
  if (!assistantFab || !assistantPanel) return;

  const showBuddy = Boolean(state.user);
  assistantFab.classList.toggle("hidden", !showBuddy);
  assistantFab.classList.toggle("active", voiceState.mode !== "idle");
  assistantPanel.classList.toggle("hidden", !showBuddy || !voiceState.open);

  const message = assistantPanel.querySelector("#dna-msg");
  if (message) message.innerHTML = dnaMessageHtml();

  const readBtn = assistantPanel.querySelector("#dna-read-btn");
  const micBtn = assistantPanel.querySelector("#dna-mic-btn");
  const auto = assistantPanel.querySelector("#dna-auto");
  const question = currentAssistantQuestion();

  if (readBtn) readBtn.disabled = !question || !voiceState.ttsOk;
  if (micBtn) {
    micBtn.disabled = !question || !voiceState.sttOk || isRanking(question.questionType);
    micBtn.classList.toggle("recording", voiceState.mode === "listening");
    micBtn.innerHTML = voiceState.mode === "listening" ? "■ Stop" : "🎤 Speak answer";
  }
  if (auto) auto.checked = dnaAutoReadEnabled();
}

function stopAssistantSpeaking() {
  if (!voiceState.ttsOk) return;
  window.speechSynthesis.cancel();
  if (voiceState.mode === "speaking") voiceState.mode = "idle";
}

function stopAssistantListening() {
  if (voiceState.recognition) {
    try { voiceState.recognition.stop(); } catch { /* already stopped */ }
    voiceState.recognition = null;
  }
  if (voiceState.mode === "listening") {
    voiceState.mode = "idle";
    voiceState.interim = "";
  }
}

function stopAssistantActivity() {
  stopAssistantSpeaking();
  stopAssistantListening();
}

function speakAloud(text, onDone) {
  if (!voiceState.ttsOk) {
    onDone?.();
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  utterance.pitch = 1.05;
  const voices = window.speechSynthesis.getVoices();
  utterance.voice =
    voices.find((v) => /en[-_]IN/i.test(v.lang)) ||
    voices.find((v) => /^en/i.test(v.lang)) ||
    null;
  utterance.onstart = () => {
    voiceState.mode = "speaking";
    updateAssistantPanel();
  };
  utterance.onend = () => {
    if (voiceState.mode === "speaking") voiceState.mode = "idle";
    updateAssistantPanel();
    onDone?.();
  };
  utterance.onerror = utterance.onend;
  window.speechSynthesis.speak(utterance);
}

function buildQuestionSpeech(question) {
  if (isReflection(question.questionType)) {
    return `${question.question} Please type, or speak, a few sentences about yourself.`;
  }
  if (isRanking(question.questionType)) {
    return `${question.question} Rearrange the options with the up and down arrows, most like you first.`;
  }
  const optionList = question.options.map((opt, i) => `${i + 1}. ${opt}`).join(". ");
  return `${question.question} You have ${question.options.length} options: ${optionList}.`;
}

function readQuestionAloud({ thenListen = false } = {}) {
  const question = currentAssistantQuestion();
  if (!question || !voiceState.ttsOk) return;
  stopAssistantListening();
  const text = buildQuestionSpeech(question);
  speakAloud(text, thenListen ? () => startAssistantListening() : undefined);
}

function normaliseSpeech(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function matchSpokenOption(transcript, question) {
  const said = normaliseSpeech(transcript);
  if (!said) return null;

  // 1) Explicit position: "option 3", "choice number two", plain "2"/"three".
  let index = null;
  const numbered = said.match(/(?:option|choice|answer|number)\s+(\d+)/);
  if (numbered) index = parseInt(numbered[1], 10);
  if (index == null) index = DNA_NUMBER_WORDS[said] ?? null;
  if (index == null) {
    for (const [word, n] of Object.entries(DNA_NUMBER_WORDS)) {
      if (new RegExp(`(?:option|choice|answer|number)\\s+${word}\\b`).test(said)) {
        index = n;
        break;
      }
    }
  }
  if (index != null && index >= 1 && index <= question.options.length) {
    return question.options[index - 1];
  }

  // 2) Whole-phrase match against the option labels ("strongly agree").
  for (const option of question.options) {
    const label = normaliseSpeech(option);
    if (
      label === said ||
      (said.length > 2 && label.includes(said)) ||
      (label.length > 2 && said.includes(label))
    ) {
      return option;
    }
  }

  // 3) Best token-overlap fallback.
  const saidTokens = new Set(said.split(" "));
  let best = null;
  let bestScore = 0;
  for (const option of question.options) {
    const labelTokens = normaliseSpeech(option).split(" ").filter(Boolean);
    if (!labelTokens.length) continue;
    const score = labelTokens.filter((token) => saidTokens.has(token)).length / labelTokens.length;
    if (score > bestScore) {
      bestScore = score;
      best = option;
    }
  }
  return bestScore >= 0.5 ? best : null;
}

function applySpokenChoice(question, optionValue) {
  const label = [...document.querySelectorAll("#options .option")].find(
    (entry) => entry.querySelector("input")?.value === optionValue,
  );
  const input = label?.querySelector("input");
  if (!input) return false;
  input.checked = true;
  input.dispatchEvent(new Event("change"));
  return true;
}

function handleAssistantTranscript(transcript) {
  const question = currentAssistantQuestion();
  if (!question) return;
  const said = normaliseSpeech(transcript);

  // Hands-free navigation.
  if (/\b(next|submit|done)\b/.test(said)) {
    document.getElementById("next-btn")?.click();
    return;
  }
  if (/\b(previous|go back)\b/.test(said)) {
    document.getElementById("prev-btn")?.click();
    return;
  }

  if (isRanking(question.questionType)) {
    speakAloud("Ranking questions need the arrow buttons on the screen.");
    return;
  }

  if (isReflection(question.questionType)) {
    const field = document.getElementById("answer-input");
    if (field) {
      field.value = transcript.trim();
      field.dispatchEvent(new Event("input"));
      saveCurrentAnswer();
      speakAloud("Noted! I have typed that for you — review it and press Next when ready.");
    }
    return;
  }

  const optionValue = matchSpokenOption(transcript, question);
  if (!optionValue) {
    speakAloud("Sorry, I could not match that to an option. Try naming the option, or say option one, two, three.");
    return;
  }
  if (applySpokenChoice(question, optionValue)) {
    speakAloud(`You chose: ${optionValue}. Say next when you are ready.`);
  }
}

function startAssistantListening() {
  const question = currentAssistantQuestion();
  if (!question || !voiceState.sttOk) return;

  stopAssistantSpeaking();
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SR();
  recognition.lang = "en-IN";
  recognition.interimResults = true;
  recognition.maxAlternatives = 3;
  recognition.continuous = false;

  voiceState.recognition = recognition;
  voiceState.mode = "listening";
  voiceState.interim = "";
  updateAssistantPanel();

  recognition.onresult = (event) => {
    let interim = "";
    let finalText = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) finalText += result[0].transcript;
      else interim += result[0].transcript;
    }
    if (finalText) {
      stopAssistantListening();
      handleAssistantTranscript(finalText.trim());
    } else {
      voiceState.interim = interim;
      updateAssistantPanel();
    }
  };
  recognition.onerror = () => {
    stopAssistantListening();
    updateAssistantPanel();
  };
  recognition.onend = () => {
    stopAssistantListening();
    updateAssistantPanel();
  };

  try {
    recognition.start();
  } catch {
    // start() throws if recognition is already running — safe to ignore.
    stopAssistantListening();
    updateAssistantPanel();
  }
}

function toggleAssistantMic() {
  if (voiceState.mode === "listening") stopAssistantListening();
  else startAssistantListening();
  updateAssistantPanel();
}

function syncAssistantToView() {
  if (!state.user) {
    stopAssistantActivity();
    if (assistantFab) assistantFab.classList.add("hidden");
    if (assistantPanel) assistantPanel.classList.add("hidden");
    return;
  }

  ensureAssistantDom();

  // Auto-read each new question as it appears (only once per question).
  const question = currentAssistantQuestion();
  if (question && voiceState.ttsOk && dnaAutoReadEnabled()) {
    const key = `${state.assessmentVersion}:${state.currentIndex}:${question.id}`;
    if (dnaLastAutoReadKey !== key) {
      dnaLastAutoReadKey = key;
      clearTimeout(dnaSyncTimer);
      dnaSyncTimer = setTimeout(() => readQuestionAloud(), 400);
    }
  }

  updateAssistantPanel();
}


if (contactButton) {
  contactButton.onclick = () => {
    state.previousView = state.view;
    state.view = "contact";
    render();
  };
}

if (whatsNewButton) {
  whatsNewButton.onclick = () => {
    state.previousView = state.view;
    state.view = "whatsnew";
    render();
  };
}

async function loadAssessment() {
  let res = await fetch(`/api/assessment?version=${encodeURIComponent(state.assessmentVersion)}`).catch(() => null);
  if (!res?.ok) res = await fetch(`./data/assessment-v${state.assessmentVersion}.json`);
  if (!res.ok) throw new Error("Could not load assessment data.");
  state.assessment = await res.json();
  state.questions = state.assessment.questionBank.flat();
}

async function loadProgress() {
  const res = await fetch(`/api/progress?version=${encodeURIComponent(state.assessmentVersion)}`);
  if (!res.ok) return null;
  return res.json();
}

async function loadLatestResult() {
  const res = await fetch(`/api/results/latest?version=${encodeURIComponent(state.assessmentVersion)}`);
  if (!res.ok) return null;
  return res.json();
}

async function fetchVersionHistory() {
  const res = await fetch("/api/assessment/history").catch(() => null);
  if (!res?.ok) return {};
  return res.json().catch(() => ({}));
}

// Routing after login/session-restore:
// - Students with V4/V5 history get a chooser (V6 + their legacy versions).
// - Everyone else goes straight into V6 with no version selection at all.
async function routeAuthenticatedUser() {
  const history = await fetchVersionHistory();
  const legacy = ["4", "5"].filter((v) => history[v]?.inProgress || history[v]?.completed);
  state.availableVersions = ["6", ...legacy];

  await loadAssessment(); // loads the current default (V6)

  if (legacy.length) {
    state.view = "version-select";
    return;
  }

  await restoreAssessmentState(); // V6 progress/result only
  state.view = state.latestResult ? "completed" : "welcome";
}

async function restoreAssessmentState() {
  const [progress, latestResult] = await Promise.all([loadProgress(), loadLatestResult()]);
  state.latestResult = latestResult;
  state.student = progress?.student || null;
  state.answers = progress?.answers || {};
  state.currentIndex = progress ? findResumeIndex(state.answers, progress.currentIndex) : 0;
  state.startedAt = progress?.startedAt || null;
}

async function selectAssessmentVersion(version) {
  if (state.hasUnsavedChanges && state.assessmentVersion !== version) {
    if (!window.confirm(`You have unsaved changes in Version ${state.assessmentVersion}. Switch to Version ${version} anyway?`)) {
      return;
    }
  }
  state.assessmentVersion = version;
  state.latestResult = null;
  state.student = null;
  state.answers = {};
  state.currentIndex = 0;
  state.startedAt = null;
  state.saveMessage = "";
  state.hasUnsavedChanges = false;
  await loadAssessment();
  await restoreAssessmentState();
  state.view = state.latestResult ? "completed" : "welcome";
  render();
}

function findResumeIndex(answers, savedIndex) {
  const firstUnansweredIndex = state.questions.findIndex((question) => {
    const answer = answers?.[question.id];
    return answer === undefined || answer === null || answer === "";
  });

  if (firstUnansweredIndex !== -1) return firstUnansweredIndex;
  return Math.min(savedIndex || 0, state.questions.length - 1);
}

async function saveProgress(overwrite = false) {
  if (!state.student || !state.startedAt) return;
  const payload = JSON.stringify({
    student: state.student,
    answers: state.answers,
    currentIndex: state.currentIndex,
    startedAt: state.startedAt,
    overwrite,
  });
  const res = await fetch(`/api/progress?version=${encodeURIComponent(state.assessmentVersion)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: payload,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    const saveError = new Error(error.error || "Could not save assessment progress.");
    saveError.status = res.status;
    throw saveError;
  }
  state.hasUnsavedChanges = false;
  state.saveMessage = "Assessment saved.";
  return res.json();
}

function showProgressSaveError(error) {
  const progressError = document.getElementById("progress-save-error");
  if (progressError) {
    progressError.textContent = error.message || "Your progress could not be saved yet.";
    progressError.classList.remove("hidden");
  }
}

async function saveAssessment() {
  saveCurrentAnswer();
  try {
    await saveProgress();
  } catch (err) {
    if (err.status !== 409) {
      showProgressSaveError(err);
      return;
    }
    if (!window.confirm("A saved assessment already exists. Saving now will replace that saved context with your current answers. Continue?")) return;
    try {
      await saveProgress(true);
    } catch (overwriteError) {
      showProgressSaveError(overwriteError);
      return;
    }
  }
  renderQuestion();
}

async function clearProgress() {
  await fetch(`/api/progress?version=${encodeURIComponent(state.assessmentVersion)}`, { method: "DELETE" });
}

function updateUserMenu() {
  if (!state.user) {
    userMenu.classList.add("hidden");
    userMenu.innerHTML = "";
    return;
  }

  const displayName = state.user.name || state.user.firstName || state.user.email;
  userMenu.classList.remove("hidden");
  userMenu.innerHTML = `
    ${state.user.picture ? `<img class="user-avatar" src="${escapeAttr(state.user.picture)}" alt="${escapeAttr(displayName)}" />` : ""}
    <span class="user-name" title="${escapeAttr(state.user.email)}">${escapeHtml(displayName)}</span>
    <button class="logout-icon-btn" id="logout-btn" type="button" aria-label="Log out" title="Log out">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
    </button>
  `;
  document.getElementById("logout-btn").onclick = async () => {
    if (state.view === "question" && state.hasUnsavedChanges) {
      if (!window.confirm("You have unsaved answers. Save and replace the existing saved assessment before logging out?")) return;
      saveCurrentAnswer();
      try {
        await saveProgress(true);
      } catch (err) {
        showProgressSaveError(err);
        return;
      }
    }
    await logout();
    dismissThemeTip(false);
    state.user = null;
    state.student = null;
    state.answers = {};
    state.view = "login";
    render();
  };
}

function setProgress() {
  if (state.view !== "question") {
    progressBar.classList.add("hidden");
    progressLabel.classList.add("hidden");
    return;
  }
  progressBar.classList.remove("hidden");
  progressLabel.classList.remove("hidden");
  const pct = ((state.currentIndex + 1) / state.questions.length) * 100;
  progressFill.style.width = `${pct}%`;
  progressLabel.textContent = `Question ${state.currentIndex + 1} of ${state.questions.length}`;
}

function renderLogin() {
  main.innerHTML = `
    <section class="login-layout">
      <div class="login-hero-media">
        <img src="/public/careerdna-hero.png" alt="Students exploring their future careers with CareerDNA" />
      </div>
      <div class="card login-card">
        <img class="login-brand-mark" src="/public/careerdna-icon.png" alt="CareerDNA" />
        <p class="eyebrow login-eyebrow">YOUR CAREER JOURNEY STARTS HERE</p>
        <h1>Discover the path that fits you</h1>
        <p class="subtitle">Sign in to begin a thoughtful career discovery assessment built for students in grades 9-12.</p>

        <div id="google-signin-btn"></div>
        <p class="login-note">Your saved progress is available whenever you sign in again.</p>
        <div id="login-error" class="error hidden"></div>
      </div>
    </section>
  `;

  signInWithGoogle()
    .then(async (user) => {
      state.user = user;
      if (user.theme) applyTheme(user.theme);
      if (user.profileComplete) {
        await routeAuthenticatedUser();
      } else {
        state.view = "mobile";
      }
      render();
      // Nudge the freshly signed-in student to personalise their theme.
      if (state.view !== "mobile") setTimeout(showThemeTip, 600);
    })
    .catch((err) => {
      const errorEl = document.getElementById("login-error");
      if (errorEl) {
        errorEl.textContent = err.message;
        errorEl.classList.remove("hidden");
      }
    });
}

function renderMobileForm() {
  main.innerHTML = `
    <div class="card">
      <h1>Complete Your Profile</h1>
      <p class="subtitle">Welcome, ${escapeHtml(state.user.firstName)}! Please add your mobile number to continue.</p>
      <div class="info-box">
        <strong>Signed in as</strong>
        ${escapeHtml(state.user.email)}
      </div>
      <form id="mobile-form" class="form-grid">
        <div class="form-group full">
          <label for="mobileNumber">Mobile Number *</label>
          <input id="mobileNumber" name="mobileNumber" type="tel" placeholder="10-digit mobile number" maxlength="10" required />
        </div>
        <div id="mobile-error" class="error full hidden"></div>
      </form>
      <div class="actions">
        <span></span>
        <button class="btn btn-primary" id="save-mobile-btn">Continue</button>
      </div>
    </div>
  `;

  document.getElementById("save-mobile-btn").onclick = async () => {
    const mobile = document.getElementById("mobileNumber").value.trim();
    const errorEl = document.getElementById("mobile-error");

    if (!/^[6-9]\d{9}$/.test(mobile)) {
      errorEl.textContent = "Enter a valid 10-digit Indian mobile number.";
      errorEl.classList.remove("hidden");
      return;
    }

    try {
      state.user = await saveMobileNumber(mobile);
      await routeAuthenticatedUser();
      render();
      // First-time login just completed the profile — offer the theme nudge.
      setTimeout(showThemeTip, 600);
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.remove("hidden");
    }
  };
}

async function renderVersionSelect() {
  // Only versions the student may use: V6 always, plus legacy V4/V5 they
  // started earlier. New takers never reach this page at all.
  const versions = state.availableVersions?.length ? state.availableVersions : ["6"];
  const [progresses, results] = await Promise.all([
    Promise.all(versions.map((v) => fetch(`/api/progress?version=${v}`).then((r) => (r.ok ? r.json() : null)).catch(() => null))),
    Promise.all(versions.map((v) => fetch(`/api/results/latest?version=${v}`).then((r) => (r.ok ? r.json() : null)).catch(() => null))),
  ]);
  const statusFor = (i) => (results[i] ? "Completed" : progresses[i]?.startedAt ? "In Progress" : null);

  const infoMap = {
    "4": {
      title: "Version 4 (V4)",
      duration: "~35 min",
      questions: "120 questions",
      badge: "Standard Assessment",
      desc: "Comprehensive evaluation of personality, interests, thinking style, emotional intelligence, and career suitability.",
    },
    "5": {
      title: "Version 5 (V5)",
      duration: "~40 min",
      questions: "124 questions",
      badge: "Enhanced & Weighted",
      desc: "Advanced assessment featuring fine-grained option weighting, enhanced competency mapping, and environmental interest signals.",
    },
    "6": {
      title: "Version 6 (V6)",
      duration: "~30 min",
      questions: "88 questions",
      badge: "New · Recommended",
      desc: "The optimised assessment: Interest Explorer, 19 career clusters (sports, defence, agriculture, design, finance and more), and a personalised career map with real roles, exams and first steps — in 30 minutes.",
    },
  };

  const solo = versions.length === 1;
  main.innerHTML = `
    <div class="card version-select-card">
      <p class="eyebrow">CAREERDNA ASSESSMENT VERSION</p>
      <h1>${solo ? "Begin Your Assessment" : "Select Assessment Version"}</h1>
      <p class="subtitle">Welcome, ${escapeHtml(state.user?.firstName || "Student")}! ${solo
        ? "You'll take our latest Version 6 assessment."
        : "You can continue a previous version or start the latest Version 6."}</p>

      <div class="version-select-grid">
        ${versions.map((v, i) => {
          const info = infoMap[v];
          const status = statusFor(i);
          return `
        <div class="version-card ${state.assessmentVersion === v ? "selected" : ""}" data-version="${v}">
          <div class="version-card-header">
            <span class="version-title">${info.title}</span>
            <span class="version-badge ${v === "6" ? "highlight" : ""}">${status ? `${info.badge} · <strong>${status}</strong>` : info.badge}</span>
          </div>
          <div class="version-meta-row">
            <span>⏱️ ${info.duration}</span>
            <span>📝 ${info.questions}</span>
          </div>
          <p class="version-desc">${info.desc}</p>
        </div>`;
        }).join("")}
      </div>

      <div class="actions">
        <button class="btn btn-secondary" id="logout-select-btn">Logout</button>
        <button class="btn btn-primary" id="confirm-version-btn">Continue to Assessment</button>
      </div>
    </div>
  `;

  document.querySelectorAll(".version-card").forEach((card) => {
    card.onclick = () => {
      document.querySelectorAll(".version-card").forEach((c) => c.classList.remove("selected"));
      card.classList.add("selected");
      state.assessmentVersion = card.dataset.version;
    };
  });

  document.getElementById("logout-select-btn").onclick = async () => {
    await logout();
    dismissThemeTip(false);
    state.user = null;
    state.student = null;
    state.answers = {};
    state.view = "login";
    render();
  };

  document.getElementById("confirm-version-btn").onclick = async () => {
    await selectAssessmentVersion(state.assessmentVersion);
  };
}

function renderWelcome() {
  const a = state.assessment;
  const hasProgress = Boolean(state.student && state.startedAt);
  main.innerHTML = `
    <div class="welcome-hero">
      <p class="eyebrow">CAREER DISCOVERY FOR GRADES 9-12</p>
      <h1>${a.assessmentTitle}</h1>
      <p>${a.assessmentPurpose}</p>
      <div class="badge-row">
        <span class="badge">${a.coreQuestions} core questions + ${a.validityAndReverseScoredQuestions} quality checks</span>
        <span class="badge">~${a.recommendedDurationMinutes} min</span>
        <span class="badge">Save and resume anytime</span>
      </div>
    </div>
    <div class="card welcome-card">
      ${state.availableVersions?.length > 1 ? `
      <div class="form-group">
        <label for="assessment-version">Assessment version</label>
        <select id="assessment-version">
          ${state.availableVersions.map((v) => {
            const labels = { "4": "Version 4 (35 min)", "5": "Version 5 (40 min)", "6": "Version 6 — New (30 min)" };
            return `<option value="${v}" ${state.assessmentVersion === v ? "selected" : ""}>${labels[v] || `Version ${v}`}</option>`;
          }).join("")}
        </select>
      </div>` : ""}
      <div class="info-box">
        <strong>Designed for reflection, not right answers</strong>
        ${a.assessmentDisclaimer}
      </div>
      <div class="info-box">
        <strong>How to respond</strong>
        ${a.studentInstructions}
      </div>
      <h2>Sections</h2>
      <div class="sections-grid">
        ${a.sections.map((s) => `
          <div class="section-chip">
            ${s.sectionName}
            <span>${s.questionCount} questions</span>
          </div>
        `).join("")}
      </div>
      <div class="actions">
        ${hasProgress ? '<button class="btn btn-secondary" id="restart-btn">Start over</button>' : '<span></span>'}
        <button class="btn btn-primary" id="start-btn">${hasProgress ? "Resume assessment" : "Begin assessment"}</button>
      </div>
    </div>
  `;
  const versionSelect = document.getElementById("assessment-version");
  if (versionSelect) {
    versionSelect.onchange = async (event) => {
      await selectAssessmentVersion(event.target.value);
    };
  }
  document.getElementById("start-btn").onclick = () => {
    state.view = hasProgress ? "question" : "student";
    render();
  };
  if (hasProgress) {
    document.getElementById("restart-btn").onclick = async () => {
      if (!window.confirm("Starting over will permanently replace your saved assessment context. Continue?")) return;
      await clearProgress();
      state.answers = {};
      state.currentIndex = 0;
      state.student = null;
      state.startedAt = null;
      state.hasUnsavedChanges = false;
      state.saveMessage = "";
      render();
    };
  }
}

function renderCompletedAssessment() {
  const completedAt = state.latestResult?.completedAt || state.latestResult?.savedAt;
  const hasRetakeProgress = Boolean(state.student && state.startedAt);
  const completedDate = completedAt
    ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(completedAt))
    : "earlier";

  main.innerHTML = `
    <div class="card completed-card">
      <p class="eyebrow">ASSESSMENT COMPLETE</p>
      <h1>You have already completed CareerDNA</h1>
      <p class="subtitle">Your latest assessment was completed on ${escapeHtml(completedDate)}. ${hasRetakeProgress ? "A new attempt is also in progress." : "Would you like to take the assessment again?"}</p>
      <div class="actions completed-actions">
        <button class="btn btn-secondary" id="view-result-btn">View last result</button>
        <button class="btn btn-primary" id="take-again-btn">${hasRetakeProgress ? "Resume new attempt" : "Take again"}</button>
      </div>
    </div>
  `;

  document.getElementById("view-result-btn").onclick = () => {
    state.result = state.latestResult.result;
    state.saveInfo = { success: true, savedAt: state.latestResult.savedAt };
    state.view = "result";
    render();
  };
  document.getElementById("take-again-btn").onclick = () => {
    if (hasRetakeProgress) {
      state.view = "question";
      render();
      return;
    }
    if (!window.confirm("Starting a new assessment will replace your current assessment status. Continue?")) return;
    state.answers = {};
    state.currentIndex = 0;
    state.student = null;
    state.startedAt = null;
    state.latestResult = null;
    state.view = "student";
    render();
  };
}

function renderWhatsNew() {
  const newDomains = [
    "Finance, Investment & FinTech",
    "Design & User Experience",
    "Media, Creative Arts & Creator Economy",
    "Sports, Fitness & Esports",
    "Architecture & Built Environment",
    "Hospitality, Tourism & Culinary Arts",
    "Defence & Uniformed Services",
    "Skilled Trades & Applied Technology",
  ];
  const themes = THEMES.map((t) => t.name).join(" · ");
  const assessment = state.assessment || {};
  const totalQuestions = assessment.totalQuestions ?? 88;
  const coreQuestions = assessment.coreQuestions ?? 79;
  const validityQuestions = assessment.validityAndReverseScoredQuestions ?? 10;
  const sectionCount = assessment.sections?.length ?? 15;
  const questionTypes = assessment.questionTypesUsed?.length ?? 9;
  const clusterCount = assessment.careerClusters?.length ?? 19;

  main.innerHTML = `
    <section class="card whatsnew-card">
      <p class="eyebrow">PRODUCT UPDATES</p>
      <h1>What's New</h1>
      <p class="subtitle">The latest improvements to the CareerDNA Career Assessment.</p>

      <article class="whatsnew-feature">
        <div class="whatsnew-feature-head">
          <span class="whatsnew-badge">Assessment v6</span>
          <h2>Improvised questions with extended domain coverage</h2>
        </div>
        <p>
          The question bank has been reworked into a coverage-optimised set of
          ${totalQuestions} questions (${coreQuestions} core + ${validityQuestions} validity checks)
          across ${sectionCount} sections and ${questionTypes} question types — sharper,
          more student-friendly items with every section and career domain still covered.
        </p>
        <p><strong>Coverage now extends to ${clusterCount} career domains</strong> (up from 12), including these newly added areas:</p>
        <ul class="domain-list">
          ${newDomains.map((d) => `<li>${escapeHtml(d)}</li>`).join("")}
          <li>…plus all earlier domains such as Engineering &amp; Technology, Medicine &amp; Health Sciences, Business &amp; Entrepreneurship, Law &amp; Public Policy, Psychology &amp; Counselling, Data &amp; Analytics and AI &amp; Future Technologies.</li>
        </ul>
      </article>

      <article class="whatsnew-feature">
        <div class="whatsnew-feature-head">
          <span class="whatsnew-badge">Personalisation</span>
          <h2>Theme selector slider in the footer</h2>
        </div>
        <p>
          A new slider at the bottom of every page lets you instantly switch between
          eight colour themes — ${escapeHtml(themes)}. Your choice is remembered on this
          device and synced to your account when you are signed in.
        </p>
      </article>

      <div class="actions"><button class="btn btn-secondary" id="whatsnew-back-btn">Back</button></div>
    </section>
  `;

  document.getElementById("whatsnew-back-btn").onclick = () => {
    state.view = state.previousView === "whatsnew" ? "welcome" : state.previousView;
    render();
  };
}

function renderContact() {
  main.innerHTML = `
    <section class="card contact-card">
      <p class="eyebrow">CAREERDNA SUPPORT</p>
      <h1>Contact Us</h1>
      <p class="subtitle">Get in touch for help with CareerDNA assessments, reports, or school access.</p>
      <div class="contact-details">
        <a href="tel:9822320290"><strong>Phone</strong><span>9822320290</span></a>
        <a href="mailto:sumeetboob@gmail.com"><strong>Email</strong><span>sumeetboob@gmail.com</span></a>
      </div>
      <div class="actions"><button class="btn btn-secondary" id="contact-back-btn">Back</button></div>
    </section>
  `;

  document.getElementById("contact-back-btn").onclick = () => {
    state.view = state.previousView === "contact" ? "welcome" : state.previousView;
    render();
  };
}

function renderStudentForm() {
  const u = state.user;
  main.innerHTML = `
    <div class="card">
      <h1>Your Details</h1>
      <p class="subtitle">Confirm your details before the assessment begins.</p>
      <form id="student-form" class="form-grid">
        <div class="form-group">
          <label for="firstName">First Name *</label>
          <input id="firstName" name="firstName" value="${escapeAttr(u.firstName)}" required />
        </div>
        <div class="form-group">
          <label for="lastName">Last Name *</label>
          <input id="lastName" name="lastName" value="${escapeAttr(u.lastName)}" required />
        </div>
        <div class="form-group">
          <label for="email">Gmail *</label>
          <input id="email" name="email" type="email" value="${escapeAttr(u.email)}" readonly />
        </div>
        <div class="form-group">
          <label for="mobileNumber">Mobile *</label>
          <input id="mobileNumber" name="mobileNumber" type="tel" value="${escapeAttr(u.mobileNumber)}" readonly />
        </div>
        <div class="form-group">
          <label for="grade">Grade *</label>
          <select id="grade" name="grade" required>
            <option value="">Select grade</option>
            <option value="9" ${u.grade === "9" ? "selected" : ""}>Grade 9</option>
            <option value="10" ${u.grade === "10" ? "selected" : ""}>Grade 10</option>
            <option value="11" ${u.grade === "11" ? "selected" : ""}>Grade 11</option>
            <option value="12" ${u.grade === "12" ? "selected" : ""}>Grade 12</option>
          </select>
        </div>
        <div class="form-group full">
          <label for="school">School</label>
          <input id="school" name="school" value="${escapeAttr(u.school || "")}" />
        </div>
        <div id="form-error" class="error full hidden"></div>
      </form>
      <div class="actions">
        <button class="btn btn-secondary" id="back-btn">Back</button>
        <button class="btn btn-primary" id="continue-btn">Continue</button>
      </div>
    </div>
  `;

  document.getElementById("back-btn").onclick = () => {
    state.view = "welcome";
    render();
  };

  document.getElementById("continue-btn").onclick = async () => {
    const form = document.getElementById("student-form");
    const data = Object.fromEntries(new FormData(form));
    const errorEl = document.getElementById("form-error");

    if (!data.firstName?.trim() || !data.lastName?.trim() || !data.grade || !isValidEmail(data.email) || !isValidMobileNumber(data.mobileNumber)) {
      errorEl.textContent = "A valid email address, mobile number, and all required details are needed to begin.";
      errorEl.classList.remove("hidden");
      return;
    }

    const student = {
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      email: state.user.email,
      mobileNumber: state.user.mobileNumber,
      grade: data.grade,
      school: data.school?.trim() || "",
    };
    const startedAt = new Date().toISOString();

    state.student = student;
    state.startedAt = startedAt;
    state.currentIndex = 0;
    state.hasUnsavedChanges = false;
    state.saveMessage = "";
    state.view = "question";
    render();
    saveProgress().catch(showProgressSaveError);
  };
}

function isRanking(type) {
  return type === "Ranking";
}

function isReflection(type) {
  return type === "Reflection";
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function isValidMobileNumber(value) {
  return /^[6-9]\d{9}$/.test(String(value || "").trim());
}

function isLikert(question) {
  return question.questionType === "Likert Scale" ||
    (question.options?.length === 5 && question.options.includes("Strongly Agree"));
}

function isMultipleChoice(question) {
  return question.questionType === "Multiple Choice";
}

function renderQuestionInput(question, currentAnswer) {
  if (isReflection(question.questionType)) {
    return `
      <textarea id="answer-input" placeholder="Share your thoughts in a few sentences...">${currentAnswer || ""}</textarea>
    `;
  }

  if (isRanking(question.questionType)) {
    const ranked = currentAnswer || [...question.options];
    return `
      <p class="meta">Place the option most like you at the top. Use the arrows to reorder.</p>
      <ul class="ranking-list" id="ranking-list">
        ${ranked.map((opt, i) => `
          <li class="ranking-item" data-option="${escapeAttr(opt)}">
            <span class="ranking-rank">${i + 1}</span>
            <span class="ranking-text">${escapeHtml(opt)}</span>
            <div class="rank-actions">
              <button class="rank-button" type="button" data-move="up" aria-label="Move up" ${i === 0 ? "disabled" : ""}>Up</button>
              <button class="rank-button" type="button" data-move="down" aria-label="Move down" ${i === ranked.length - 1 ? "disabled" : ""}>Down</button>
            </div>
          </li>
        `).join("")}
      </ul>
    `;
  }

  return `
    <div class="options" id="options">
      ${question.options.map((opt) => `
        <label class="option ${isMultipleChoice(question) ? currentAnswer?.includes(opt) ? "selected" : "" : currentAnswer === opt ? "selected" : ""}">
          <input type="${isMultipleChoice(question) ? "checkbox" : "radio"}" name="answer" value="${escapeAttr(opt)}" ${isMultipleChoice(question) ? currentAnswer?.includes(opt) ? "checked" : "" : currentAnswer === opt ? "checked" : ""} />
          <span>${escapeHtml(opt)}</span>
        </label>
      `).join("")}
    </div>
  `;
}

function setupRankingControls() {
  const list = document.getElementById("ranking-list");
  if (!list) return;

  list.querySelectorAll(".rank-button").forEach((button) => {
    button.addEventListener("click", () => {
      const item = button.closest(".ranking-item");
      if (button.dataset.move === "up") list.insertBefore(item, item.previousElementSibling);
      else list.insertBefore(item.nextElementSibling, item);
      const question = state.questions[state.currentIndex];
      state.answers[question.id] = [...list.querySelectorAll(".ranking-item")].map((entry) => entry.dataset.option);
      state.hasUnsavedChanges = true;
      renderQuestion();
    });
  });
}

function getCurrentAnswer(question) {
  if (isRanking(question.questionType)) {
    return [...document.querySelectorAll(".ranking-item")].map((el) => el.dataset.option);
  }
  if (isReflection(question.questionType)) {
    return document.getElementById("answer-input")?.value?.trim() || "";
  }
  if (isMultipleChoice(question)) {
    return [...document.querySelectorAll('input[name="answer"]:checked')].map((input) => input.value);
  }
  const selected = document.querySelector('input[name="answer"]:checked');
  return selected?.value || null;
}

function saveCurrentAnswer() {
  const question = state.questions[state.currentIndex];
  const answer = getCurrentAnswer(question);
  if (answer !== null && answer !== "") {
    const previousAnswer = state.answers[question.id];
    state.answers[question.id] = answer;
    if (JSON.stringify(previousAnswer) !== JSON.stringify(answer)) {
      state.hasUnsavedChanges = true;
      state.saveMessage = "";
    }
  }
}

function validateAnswer(question) {
  const answer = getCurrentAnswer(question);
  if (isReflection(question.questionType)) {
    return answer && answer.length >= 10;
  }
  if (isRanking(question.questionType)) {
    return Array.isArray(answer) && answer.length === question.options.length;
  }
  if (isMultipleChoice(question)) {
    return Array.isArray(answer) && answer.length > 0;
  }
  return !!answer;
}

function renderQuestion() {
  const question = state.questions[state.currentIndex];
  const currentAnswer = state.answers[question.id];
  const completionPercent = Math.round(((state.currentIndex + 1) / state.questions.length) * 100);

  main.innerHTML = `
    <div class="card">
      <div class="question-header">
        <div class="question-heading-row">
          <div class="question-meta">
            <span class="tag">${question.section}</span>
            <span class="tag">${question.questionType}</span>
          </div>
          <span class="completion-badge">${completionPercent}% complete</span>
        </div>
        <p class="question-text">${escapeHtml(question.question)}</p>
      </div>
      ${renderQuestionInput(question, currentAnswer)}
      <div id="q-error" class="error hidden">Please answer before continuing.</div>
      <div id="progress-save-error" class="error hidden" role="alert"></div>
      <div id="progress-save-status" class="meta">${escapeHtml(state.saveMessage)}</div>
      <div class="actions">
        <button class="btn btn-secondary" id="prev-btn" ${state.currentIndex === 0 ? "disabled" : ""}>Previous</button>
        <button class="btn btn-secondary" id="save-btn">Save assessment</button>
        <button class="btn btn-primary" id="next-btn">
          ${state.currentIndex === state.questions.length - 1 ? "Submit" : "Next"}
        </button>
      </div>
    </div>
  `;

  document.querySelectorAll(".option").forEach((opt) => {
    opt.querySelector("input").addEventListener("change", (event) => {
      const input = opt.querySelector("input");
      if (input.type === "radio") {
        document.querySelectorAll(".option").forEach((option) => option.classList.remove("selected"));
        opt.classList.add("selected");
      } else {
        opt.classList.toggle("selected", event.target.checked);
      }
      saveCurrentAnswer();
    });
  });

  setupRankingControls();

  document.getElementById("prev-btn").onclick = async () => {
    saveCurrentAnswer();
    state.currentIndex--;
    render();
  };

  document.getElementById("save-btn").onclick = saveAssessment;

  document.getElementById("next-btn").onclick = async () => {
    const errorEl = document.getElementById("q-error");
    if (!validateAnswer(question)) {
      errorEl.classList.remove("hidden");
      return;
    }
    saveCurrentAnswer();

    if (state.currentIndex < state.questions.length - 1) {
      state.currentIndex++;
      render();
    } else {
      await submitAssessment();
    }
  };
}

async function submitAssessment() {
  const completedAt = new Date().toISOString();
  const responses = state.questions.map((q) => ({
    questionId: q.id,
    section: q.section,
    questionType: q.questionType,
    answer: state.answers[q.id] ?? null,
  }));

  const result = generateResult(
    state.assessment,
    state.student,
    responses.filter((r) => r.answer !== null),
    state.startedAt,
    completedAt
  );

  state.result = result;
  state.view = "result";

  try {
    const res = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...result, assessmentVersion: state.assessment.version }),
    });
    if (res.ok) {
      state.saveInfo = await res.json();
      state.latestResult = {
        id: state.saveInfo.resultId,
        completedAt: result.completedAt,
        savedAt: state.saveInfo.savedAt,
        result,
      };
      state.answers = {};
      state.currentIndex = 0;
      state.student = null;
      state.startedAt = null;
    } else {
      state.saveInfo = { success: false };
    }
  } catch {
    state.saveInfo = { success: false, offline: true };
  }

  render();
}

function renderResult() {
  const r = state.result;
  const topStrengths = r.topStrengths || [];

  main.innerHTML = `
    <div class="card">
      <h1>Your Results</h1>
      <p class="subtitle">Hi ${escapeHtml(r.student.firstName)}, here is your career discovery profile.</p>
      <div class="badge-row">
        <span class="badge">${r.durationMinutes} min</span>
        <span class="badge">${r.totalQuestionsAnswered} answered</span>
        <span class="badge">v${r.assessmentVersion}</span>
      </div>

      <div class="result-section">
        <h3>Top Strengths</h3>
        <ul class="strength-list">
          ${topStrengths.map((s) => `
            <li>${escapeHtml(s.competency)} <span class="score-pill">${s.score} — ${s.band}</span></li>
          `).join("")}
        </ul>
      </div>

      <div class="result-section">
        <h3>Thinking Style</h3>
        <p>${escapeHtml(r.thinkingStyle)}</p>
      </div>

      <div class="result-section">
        <h3>Learning Style</h3>
        <p>${escapeHtml(r.learningStyle)}</p>
      </div>

      <div class="result-section">
        <h3>Suggested Career Clusters</h3>
        <ul class="cluster-list">
          ${(r.suggestedCareerClusters || []).map((c) => `
            <li>${escapeHtml(c.cluster)} <span class="score-pill">${c.matchScore}% match</span></li>
          `).join("")}
        </ul>
      </div>

      ${(r.careerExploration?.length || r.careersToExplore?.length) ? `
        <div class="result-section">
          <h3>Career Exploration Map</h3>
          ${r.careerExploration?.length ? r.careerExploration.map((c) => `
            <div class="info-box">
              <strong>${escapeHtml(c.cluster)} <span class="score-pill">${c.matchScore}% match</span></strong>
              <ul class="cluster-list">
                ${c.careers.map((career) => `
                  <li>
                    <strong>${escapeHtml(career.title)}</strong> — ${escapeHtml(career.what)}<br />
                    <small>Subjects: ${escapeHtml(career.subjects)} · Exams: ${escapeHtml(career.exams)} · Outlook: ${escapeHtml(career.outlook)}<br />
                    Start now: ${escapeHtml(career.firstStep)}</small>
                  </li>
                `).join("")}
              </ul>
            </div>
          `).join("") : `
            <ul class="cluster-list">
              ${(r.careersToExplore || []).map((c) => `<li>${escapeHtml(c)}</li>`).join("")}
            </ul>
          `}
        </div>
      ` : ""}

      ${r.validityFlags?.length ? `
        <div class="result-section">
          <h3>Response Quality Notes</h3>
          <ul class="cluster-list">
            ${r.validityFlags.map((f) => `<li>${escapeHtml(f.description)}</li>`).join("")}
          </ul>
        </div>
      ` : ""}

      <div class="result-section">
        <h3>Result JSON</h3>
        <p class="meta">${state.saveInfo?.success ? `Saved as ${state.saveInfo.filename}` : "Use Download JSON to save your result file."}</p>
        <pre class="json-output" id="json-output">${escapeHtml(JSON.stringify(r, null, 2))}</pre>
      </div>

      <div class="actions">
        <button class="btn btn-secondary" id="restart-btn">Assessment options</button>
        <button class="btn btn-secondary" id="pdf-btn">Download PDF</button>
        <button class="btn btn-primary" id="download-btn">Download JSON</button>
      </div>
    </div>
  `;

  document.getElementById("restart-btn").onclick = async () => {
    if (!state.latestResult) state.latestResult = await loadLatestResult();
    if (!state.latestResult) return;
    state.view = "completed";
    render();
  };

  document.getElementById("download-btn").onclick = () => {
    const blob = new Blob([JSON.stringify(r, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `career-dna-result-${r.student.firstName}-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  document.getElementById("pdf-btn").onclick = () => downloadResultPdf(r);
}

function downloadResultPdf(result) {
  const jsPdf = window.jspdf?.jsPDF;
  if (!jsPdf) {
    window.alert("PDF export is unavailable. Please check your internet connection and try again.");
    return;
  }

  const pdf = new jsPdf({ unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  let cursorY = margin;

  const addText = (text, size = 10, bold = false) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    const lines = pdf.splitTextToSize(String(text), contentWidth);
    lines.forEach((line) => {
      if (cursorY > pageHeight - margin) {
        pdf.addPage();
        cursorY = margin;
      }
      pdf.text(line, margin, cursorY);
      cursorY += size * 0.5;
    });
    cursorY += 2;
  };

  addText("CareerDNA Assessment Results", 18, true);
  addText(`${result.student.firstName} ${result.student.lastName}`, 13, true);
  addText(`Email: ${result.student.email}`);
  addText(`Mobile: ${result.student.mobileNumber}`);
  addText(`Completed: ${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(result.completedAt))}`);
  addText(`Assessment version: ${result.assessmentVersion}`);
  addText("Top Strengths", 14, true);
  (result.topStrengths || []).forEach((strength) => addText(`${strength.competency}: ${strength.score} (${strength.band})`));
  addText("Thinking Style", 14, true);
  addText(result.thinkingStyle);
  addText("Learning Style", 14, true);
  addText(result.learningStyle);
  addText("Suggested Career Clusters", 14, true);
  (result.suggestedCareerClusters || []).forEach((cluster) => addText(`${cluster.cluster}: ${cluster.matchScore}% match`));
  if (result.careerExploration?.length) {
    addText("Career Exploration Map", 14, true);
    result.careerExploration.forEach((cluster) => {
      addText(`${cluster.cluster} (${cluster.matchScore}% match)`, 11, true);
      cluster.careers.forEach((career) =>
        addText(`  ${career.title} — ${career.what}. Subjects: ${career.subjects}; Exams: ${career.exams}; Start now: ${career.firstStep}`)
      );
    });
  }

  pdf.save(`career-dna-result-${result.student.firstName}-${Date.now()}.pdf`);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(str) {
  return String(str).replace(/"/g, "&quot;");
}

function render() {
  updateUserMenu();
  setProgress();
  if (state.view === "loading") return;
  if (state.view === "login") renderLogin();
  else if (state.view === "mobile") renderMobileForm();
  else if (state.view === "version-select") renderVersionSelect();
  else if (state.view === "welcome") renderWelcome();
  else if (state.view === "completed") renderCompletedAssessment();
  else if (state.view === "contact") renderContact();
  else if (state.view === "whatsnew") renderWhatsNew();
  else if (state.view === "student") renderStudentForm();
  else if (state.view === "question") renderQuestion();
  else if (state.view === "result") renderResult();

  syncAssistantToView();
}

async function init() {
  try {
    await loadAssessment();
    await fetchAuthConfig();

    const session = await getSession().catch(() => null);
    if (session) {
      state.user = session;
      if (session.theme) applyTheme(session.theme);
      if (session.profileComplete) {
        await routeAuthenticatedUser();
      } else {
        state.view = "mobile";
      }
    } else {
      state.view = "login";
    }

    render();
    // Returning session: still offer the theme personalisation nudge (once).
    if (state.user?.profileComplete) setTimeout(showThemeTip, 600);
  } catch (err) {
    main.innerHTML = `
      <div class="card">
        <h1>Setup required</h1>
        <p class="subtitle">Google Sign-In needs the Node server with credentials configured.</p>
        <div class="info-box">
          <strong>Steps</strong>
          1. Copy <code>.env.example</code> to <code>.env</code><br />
          2. Add your <code>GOOGLE_CLIENT_ID</code> from Google Cloud Console<br />
          3. Run <code>npm install && npm start</code>
        </div>
        <p class="error">${escapeHtml(err.message)}</p>
      </div>
    `;
  }
}

init();
