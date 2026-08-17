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
  assessmentVersion: "4",
  questions: [],
  user: null,
  student: null,
  answers: {},
  currentIndex: 0,
  startedAt: null,
  latestResult: null,
  view: "loading",
};

const main = document.getElementById("main");
const progressBar = document.getElementById("progress-bar");
const progressFill = document.getElementById("progress-fill");
const progressLabel = document.getElementById("progress-label");
const userMenu = document.getElementById("user-menu");
let progressSaveTimer;
let progressSaveQueue = Promise.resolve();

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

function findResumeIndex(answers, savedIndex) {
  const firstUnansweredIndex = state.questions.findIndex((question) => {
    const answer = answers?.[question.id];
    return answer === undefined || answer === null || answer === "";
  });

  if (firstUnansweredIndex !== -1) return firstUnansweredIndex;
  return Math.min(savedIndex || 0, state.questions.length - 1);
}

async function saveProgress() {
  if (!state.student || !state.startedAt) return;
  const payload = JSON.stringify({
    assessmentVersion: state.assessmentVersion,
    student: state.student,
    answers: state.answers,
    currentIndex: state.currentIndex,
    startedAt: state.startedAt,
  });
  const request = progressSaveQueue.then(async () => {
    const res = await fetch("/api/progress", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: payload,
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || "Could not save assessment progress.");
    }
  });
  progressSaveQueue = request.catch(() => {});
  return request;
}

function showProgressSaveError(error) {
  const progressError = document.getElementById("progress-save-error");
  if (progressError) {
    progressError.textContent = error.message || "Your progress could not be saved yet.";
    progressError.classList.remove("hidden");
  }
}

function scheduleProgressSave() {
  window.clearTimeout(progressSaveTimer);
  progressSaveTimer = window.setTimeout(() => {
    saveCurrentAnswer();
    saveProgress().catch(showProgressSaveError);
  }, 500);
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

  userMenu.classList.remove("hidden");
  userMenu.innerHTML = `
    ${state.user.picture ? `<img class="user-avatar" src="${escapeAttr(state.user.picture)}" alt="" />` : ""}
    <span class="user-email">${escapeHtml(state.user.email)}</span>
    <button class="btn btn-secondary btn-logout" id="logout-btn">Logout</button>
  `;
  document.getElementById("logout-btn").onclick = async () => {
    if (state.view === "question") {
      saveCurrentAnswer();
      try {
        await saveProgress();
      } catch (err) {
        showProgressSaveError(err);
        return;
      }
    }
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
    <section class="login-layout">
      <div class="login-hero-media">
        <img src="/public/careerdna-hero.png" alt="Students exploring their future careers with CareerDNA" />
      </div>
      <div class="card login-card">
        <img class="login-brand-mark" src="/public/careerdna-icon.png" alt="CareerDNA" />
        <p class="eyebrow login-eyebrow">YOUR CAREER JOURNEY STARTS HERE</p>
        <h1>Discover the path that fits you</h1>
        <p class="subtitle">Sign in to begin a thoughtful career discovery assessment built for students in grades 9-12.</p>
        <fieldset class="assessment-version-picker">
          <legend>Choose your assessment edition</legend>
          <label class="version-option ${state.assessmentVersion === "4" ? "selected" : ""}">
            <input type="radio" name="assessment-version" value="4" ${state.assessmentVersion === "4" ? "checked" : ""} />
            <span><strong>Version 4.0</strong><small>Expanded career, academic, and digital-readiness signals</small></span>
          </label>
          <label class="version-option ${state.assessmentVersion === "3" ? "selected" : ""}">
            <input type="radio" name="assessment-version" value="3" ${state.assessmentVersion === "3" ? "checked" : ""} />
            <span><strong>Version 3.0</strong><small>Original production assessment</small></span>
          </label>
        </fieldset>
        <div id="google-signin-btn"></div>
        <p class="login-note">Your progress is saved securely, so you can continue whenever you are ready.</p>
        <div id="login-error" class="error hidden"></div>
      </div>
    </section>
  `;

  document.querySelectorAll('input[name="assessment-version"]').forEach((input) => {
    input.addEventListener("change", async () => {
      state.assessmentVersion = input.value;
      state.assessment = null;
      state.questions = [];
      state.latestResult = null;
      try {
        await loadAssessment();
        renderLogin();
      } catch (err) {
        const errorEl = document.getElementById("login-error");
        errorEl.textContent = err.message;
        errorEl.classList.remove("hidden");
      }
    });
  });

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
  document.getElementById("start-btn").onclick = () => {
    state.view = hasProgress ? "question" : "student";
    render();
  };
  if (hasProgress) {
    document.getElementById("restart-btn").onclick = async () => {
      await clearProgress();
      state.answers = {};
      state.currentIndex = 0;
      state.student = null;
      state.startedAt = null;
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
    state.answers = {};
    state.currentIndex = 0;
    state.student = null;
    state.startedAt = null;
    state.latestResult = null;
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

    if (!data.firstName?.trim() || !data.lastName?.trim() || !data.grade) {
      errorEl.textContent = "Please fill in all required fields.";
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
        <label class="option ${currentAnswer === opt ? "selected" : ""}">
          <input type="radio" name="answer" value="${escapeAttr(opt)}" ${currentAnswer === opt ? "checked" : ""} />
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
      renderQuestion();
      saveProgress().catch(showProgressSaveError);
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
      saveCurrentAnswer();
      saveProgress().catch(showProgressSaveError);
    });
  });

  setupRankingControls();

  document.getElementById("answer-input")?.addEventListener("input", scheduleProgressSave);

  document.getElementById("prev-btn").onclick = async () => {
    saveCurrentAnswer();
    state.currentIndex--;
    render();
    saveProgress().catch(showProgressSaveError);
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
      saveProgress().catch(showProgressSaveError);
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
  else if (state.view === "completed") renderCompletedAssessment();
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
      if (session.profileComplete) {
        const [progress, latestResult] = await Promise.all([loadProgress(), loadLatestResult()]);
        state.latestResult = latestResult;
        if (progress) {
          state.student = progress.student;
          state.answers = progress.answers || {};
          state.currentIndex = findResumeIndex(state.answers, progress.currentIndex);
          state.startedAt = progress.startedAt;
        }
        state.view = state.latestResult ? "completed" : "welcome";
      } else {
        state.view = "mobile";
      }
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
