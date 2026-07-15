import { generateResult } from "./scoring.js";
import {
  fetchAuthConfig,
  getSession,
  signInWithGoogle,
  saveMobileNumber,
  logout,
} from "./auth.js";

const state = {
  assessment: null,
  questions: [],
  user: null,
  student: null,
  answers: {},
  currentIndex: 0,
  startedAt: null,
  view: "loading",
};

const main = document.getElementById("main");
const progressBar = document.getElementById("progress-bar");
const progressFill = document.getElementById("progress-fill");
const progressLabel = document.getElementById("progress-label");
const userMenu = document.getElementById("user-menu");

async function loadAssessment() {
  let res = await fetch("/api/assessment").catch(() => null);
  if (!res?.ok) {
    res = await fetch("./data/assessment-v1.json");
  }
  if (!res.ok) throw new Error("Could not load assessment data.");
  state.assessment = await res.json();
  state.questions = state.assessment.questionBank.flat();
}

function updateUserMenu() {
  if (!state.user) {
    userMenu.classList.add("hidden");
    userMenu.innerHTML = "";
    return;
  }

  userMenu.classList.remove("hidden");
  userMenu.innerHTML = `
    ${state.user.picture ? `<img class="user-avatar" src="${escapeAttr(state.user.picture)}" alt="" />` : ""}
    <span class="user-email">${escapeHtml(state.user.email)}</span>
    <button class="btn btn-secondary btn-logout" id="logout-btn">Logout</button>
  `;
  document.getElementById("logout-btn").onclick = async () => {
    await logout();
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
    <div class="card login-card">
      <div class="login-icon">🎓</div>
      <h1>Sign in to CareerDNA</h1>
      <p class="subtitle">Use your Gmail account to access the career discovery assessment.</p>
      <div id="google-signin-btn"></div>
      <p class="login-note">Only Google sign-in is supported. Your email will be used to save your results.</p>
      <div id="login-error" class="error hidden"></div>
    </div>
  `;

  signInWithGoogle()
    .then((user) => {
      state.user = user;
      state.view = user.profileComplete ? "welcome" : "mobile";
      render();
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
      state.view = "welcome";
      render();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.remove("hidden");
    }
  };
}

function renderWelcome() {
  const a = state.assessment;
  main.innerHTML = `
    <div class="card">
      <h1>${a.assessmentTitle}</h1>
      <p class="subtitle">${a.assessmentPurpose}</p>
      <div class="badge-row">
        <span class="badge">${a.totalQuestions} Questions</span>
        <span class="badge">~${a.recommendedDurationMinutes} min</span>
        <span class="badge">${a.targetGroup}</span>
      </div>
      <div class="info-box">
        <strong>Before you begin</strong>
        ${a.assessmentDisclaimer}
      </div>
      <div class="info-box">
        <strong>Instructions</strong>
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
        <span></span>
        <button class="btn btn-primary" id="start-btn">Start Assessment</button>
      </div>
    </div>
  `;
  document.getElementById("start-btn").onclick = () => {
    state.view = "student";
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
          <label for="email">Gmail</label>
          <input id="email" name="email" type="email" value="${escapeAttr(u.email)}" readonly />
        </div>
        <div class="form-group">
          <label for="mobileNumber">Mobile</label>
          <input id="mobileNumber" name="mobileNumber" type="tel" value="${escapeAttr(u.mobileNumber)}" readonly />
        </div>
        <div class="form-group">
          <label for="grade">Grade *</label>
          <select id="grade" name="grade" required>
            <option value="">Select grade</option>
            <option value="9">Grade 9</option>
            <option value="10">Grade 10</option>
            <option value="11">Grade 11</option>
            <option value="12">Grade 12</option>
          </select>
        </div>
        <div class="form-group full">
          <label for="school">School</label>
          <input id="school" name="school" />
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

  document.getElementById("continue-btn").onclick = () => {
    const form = document.getElementById("student-form");
    const data = Object.fromEntries(new FormData(form));
    const errorEl = document.getElementById("form-error");

    if (!data.firstName?.trim() || !data.lastName?.trim() || !data.grade) {
      errorEl.textContent = "Please fill in all required fields.";
      errorEl.classList.remove("hidden");
      return;
    }

    state.student = {
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      email: state.user.email,
      mobileNumber: state.user.mobileNumber,
      grade: data.grade,
      school: data.school?.trim() || "",
    };
    state.startedAt = new Date().toISOString();
    state.view = "question";
    state.currentIndex = 0;
    render();
  };
}

function isRanking(type) {
  return type === "Ranking";
}

function isReflection(type) {
  return type === "Reflection";
}

function isLikert(question) {
  return question.questionType === "Likert Scale" ||
    (question.options?.length === 5 && question.options.includes("Strongly Agree"));
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
      <p class="meta">Drag to rank from most like you (top) to least like you (bottom).</p>
      <ul class="ranking-list" id="ranking-list">
        ${ranked.map((opt, i) => `
          <li class="ranking-item" draggable="true" data-option="${escapeHtml(opt)}">
            <span class="ranking-rank">${i + 1}</span>
            <span>${escapeHtml(opt)}</span>
          </li>
        `).join("")}
      </ul>
    `;
  }

  return `
    <div class="options" id="options">
      ${question.options.map((opt) => `
        <label class="option ${currentAnswer === opt ? "selected" : ""}">
          <input type="radio" name="answer" value="${escapeAttr(opt)}" ${currentAnswer === opt ? "checked" : ""} />
          <span>${escapeHtml(opt)}</span>
        </label>
      `).join("")}
    </div>
  `;
}

function setupRankingDrag() {
  const list = document.getElementById("ranking-list");
  if (!list) return;

  let dragged = null;

  list.querySelectorAll(".ranking-item").forEach((item) => {
    item.addEventListener("dragstart", () => {
      dragged = item;
      item.classList.add("dragging");
    });
    item.addEventListener("dragend", () => {
      item.classList.remove("dragging");
      updateRankNumbers();
    });
    item.addEventListener("dragover", (e) => {
      e.preventDefault();
      const after = getDragAfterElement(list, e.clientY);
      if (after == null) list.appendChild(dragged);
      else list.insertBefore(dragged, after);
    });
  });
}

function getDragAfterElement(container, y) {
  const elements = [...container.querySelectorAll(".ranking-item:not(.dragging)")];
  return elements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) return { offset, element: child };
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function updateRankNumbers() {
  document.querySelectorAll(".ranking-item").forEach((item, i) => {
    item.querySelector(".ranking-rank").textContent = i + 1;
  });
}

function getCurrentAnswer(question) {
  if (isRanking(question.questionType)) {
    return [...document.querySelectorAll(".ranking-item")].map((el) => el.dataset.option);
  }
  if (isReflection(question.questionType)) {
    return document.getElementById("answer-input")?.value?.trim() || "";
  }
  const selected = document.querySelector('input[name="answer"]:checked');
  return selected?.value || null;
}

function saveCurrentAnswer() {
  const question = state.questions[state.currentIndex];
  const answer = getCurrentAnswer(question);
  if (answer !== null && answer !== "") {
    state.answers[question.id] = answer;
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
  return !!answer;
}

function renderQuestion() {
  const question = state.questions[state.currentIndex];
  const currentAnswer = state.answers[question.id];

  main.innerHTML = `
    <div class="card">
      <div class="question-header">
        <div class="question-meta">
          <span class="tag">${question.section}</span>
          <span class="tag">${question.questionType}</span>
          <span class="tag">${question.id}</span>
        </div>
        <p class="question-text">${escapeHtml(question.question)}</p>
      </div>
      ${renderQuestionInput(question, currentAnswer)}
      <div id="q-error" class="error hidden">Please answer before continuing.</div>
      <div class="actions">
        <button class="btn btn-secondary" id="prev-btn" ${state.currentIndex === 0 ? "disabled" : ""}>Previous</button>
        <button class="btn btn-primary" id="next-btn">
          ${state.currentIndex === state.questions.length - 1 ? "Submit" : "Next"}
        </button>
      </div>
    </div>
  `;

  document.querySelectorAll(".option").forEach((opt) => {
    opt.addEventListener("click", () => {
      document.querySelectorAll(".option").forEach((o) => o.classList.remove("selected"));
      opt.classList.add("selected");
      opt.querySelector("input").checked = true;
    });
  });

  setupRankingDrag();

  document.getElementById("prev-btn").onclick = () => {
    saveCurrentAnswer();
    state.currentIndex--;
    render();
  };

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
      body: JSON.stringify(result),
    });
    if (res.ok) {
      state.saveInfo = await res.json();
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
        <button class="btn btn-secondary" id="restart-btn">Take Again</button>
        <button class="btn btn-primary" id="download-btn">Download JSON</button>
      </div>
    </div>
  `;

  document.getElementById("restart-btn").onclick = () => {
    state.answers = {};
    state.currentIndex = 0;
    state.student = null;
    state.startedAt = null;
    state.view = "welcome";
    render();
  };

  document.getElementById("download-btn").onclick = () => {
    const blob = new Blob([JSON.stringify(r, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `career-dna-result-${r.student.firstName}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
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
  else if (state.view === "welcome") renderWelcome();
  else if (state.view === "student") renderStudentForm();
  else if (state.view === "question") renderQuestion();
  else if (state.view === "result") renderResult();
}

async function init() {
  try {
    await loadAssessment();
    await fetchAuthConfig();

    const session = await getSession().catch(() => null);
    if (session) {
      state.user = session;
      state.view = session.profileComplete ? "welcome" : "mobile";
    } else {
      state.view = "login";
    }

    render();
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
