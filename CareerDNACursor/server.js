require("dotenv").config();

const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3456;
const ROOT = __dirname;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const SESSION_SECRET = process.env.SESSION_SECRET || "change-me-in-production";
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

const usersFile = path.join(ROOT, "data", "users.json");
const sessions = new Map();
const progressSessions = new Map();
const ASSESSMENT_FILES = {
  "3": "assessment-v1.json",
  "4": "assessment-v4.json",
};

function getAssessmentVersion(value) {
  const aliases = { "1": "3", "3.0-final": "3", "4.0": "4" };
  const version = aliases[value] || value;
  return Object.hasOwn(ASSESSMENT_FILES, version) ? version : "4";
}

function progressKey(email, version) {
  return `${email}:${version}`;
}

function progressStorageError(err) {
  if (err?.code === "42703" || /assessment_version/i.test(err?.message || "")) {
    return "Database update required: run the latest supabase-schema.sql, then try again.";
  }
  if (err?.code === "42P10") {
    return "Database update required: run the latest supabase-schema.sql to add versioned assessment progress.";
  }
  return "Could not save assessment progress.";
}

app.use(express.json({ limit: "2mb" }));
app.use(express.static(ROOT));

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const idx = part.indexOf("=");
        if (idx === -1) return [part, ""];
        return [part.slice(0, idx), decodeURIComponent(part.slice(idx + 1))];
      })
  );
}

function readUsers() {
  if (!fs.existsSync(usersFile)) return {};
  return JSON.parse(fs.readFileSync(usersFile, "utf8"));
}

function writeUsers(users) {
  const dir = path.dirname(usersFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2), "utf8");
}

async function findUser(email) {
  if (!supabase) return readUsers()[email] || null;

  const { data, error } = await supabase.from("students").select("*").eq("email", email).maybeSingle();
  if (error) throw error;
  return data ? {
    email: data.email,
    name: data.name,
    picture: data.picture,
    googleSub: data.google_sub,
    mobileNumber: data.mobile_number,
    grade: data.grade,
    school: data.school,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    lastLoginAt: data.last_login_at,
  } : null;
}

async function saveUser(user) {
  if (!supabase) {
    const users = readUsers();
    users[user.email] = user;
    writeUsers(users);
    return user;
  }

  const { error } = await supabase.from("students").upsert({
    email: user.email,
    name: user.name,
    picture: user.picture || null,
    google_sub: user.googleSub || null,
    mobile_number: user.mobileNumber || null,
    grade: user.grade || null,
    school: user.school || null,
    created_at: user.createdAt,
    updated_at: user.updatedAt,
    last_login_at: user.lastLoginAt,
  });
  if (error) throw error;
  return user;
}

function createSession(user) {
  const sessionId = crypto.randomBytes(32).toString("hex");
  sessions.set(sessionId, {
    email: user.email,
    user: {
      email: user.email,
      mobileNumber: user.mobileNumber || "",
      grade: user.grade || "",
      school: user.school || "",
    },
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_MAX_AGE_MS,
  });
  return sessionId;
}

async function getSessionUser(req) {
  const cookies = parseCookies(req);
  const sessionId = cookies.career_dna_session;
  if (!sessionId) return null;

  const session = sessions.get(sessionId);
  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(sessionId);
    return null;
  }

  const user = await findUser(session.email);
  if (user) {
    session.user = {
      email: user.email,
      mobileNumber: user.mobileNumber || "",
      grade: user.grade || "",
      school: user.school || "",
    };
  }
  return user;
}

function updateSessionUser(req, user) {
  const sessionId = parseCookies(req).career_dna_session;
  const session = sessions.get(sessionId);
  if (session) {
    session.user = {
      email: user.email,
      mobileNumber: user.mobileNumber || "",
      grade: user.grade || "",
      school: user.school || "",
    };
  }
}

function setSessionCookie(res, sessionId) {
  const maxAge = Math.floor(SESSION_MAX_AGE_MS / 1000);
  res.setHeader(
    "Set-Cookie",
    `career_dna_session=${sessionId}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax`
  );
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", "career_dna_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax");
}

async function verifyGoogleToken(idToken) {
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  if (!res.ok) throw new Error("Invalid Google token.");
  const payload = await res.json();

  if (GOOGLE_CLIENT_ID && payload.aud !== GOOGLE_CLIENT_ID) {
    throw new Error("Token audience mismatch.");
  }

  if (!payload.email_verified || payload.email_verified === "false") {
    throw new Error("Google email is not verified.");
  }

  return payload;
}

function splitName(fullName = "") {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: "Student", lastName: "" };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function publicUser(user) {
  const { firstName, lastName } = splitName(user.name);
  return {
    email: user.email,
    name: user.name,
    firstName,
    lastName,
    picture: user.picture || "",
    mobileNumber: user.mobileNumber || "",
    grade: user.grade || "",
    school: user.school || "",
    profileComplete: Boolean(user.mobileNumber),
    isFirstLogin: !user.mobileNumber,
  };
}

async function requireAuth(req, res, next) {
  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ error: "Not authenticated." });
  req.user = user;
  next();
}

app.get("/api/config", (_req, res) => {
  if (!GOOGLE_CLIENT_ID) {
    return res.status(503).json({ error: "GOOGLE_CLIENT_ID is not configured." });
  }
  res.json({ googleClientId: GOOGLE_CLIENT_ID });
});

app.get("/api/health", async (_req, res) => {
  if (!supabase) {
    return res.status(503).json({ status: "unhealthy", storage: "local", error: "Supabase is not configured." });
  }

  const { error } = await supabase.from("students").select("email", { head: true });
  if (error) {
    return res.status(503).json({ status: "unhealthy", storage: "supabase", error: error.message });
  }

  res.json({ status: "ok", storage: "supabase" });
});

app.get("/api/auth/session", (req, res) => {
  getSessionUser(req).then((user) => {
  if (!user) return res.status(401).json({ error: "Not authenticated." });
  res.json(publicUser(user));
  }).catch(() => res.status(500).json({ error: "Could not load user session." }));
});

app.post("/api/auth/google", async (req, res) => {
  try {
    if (!GOOGLE_CLIENT_ID) {
      return res.status(503).json({ error: "Google Sign-In is not configured." });
    }

    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: "Missing Google credential." });

    const payload = await verifyGoogleToken(credential);
    const email = payload.email.toLowerCase();
    const existing = await findUser(email);
    const now = new Date().toISOString();

    const user = {
      email,
      name: payload.name || existing?.name || email,
      picture: payload.picture || existing?.picture || "",
      googleSub: payload.sub,
      mobileNumber: existing?.mobileNumber || "",
      grade: existing?.grade || "",
      school: existing?.school || "",
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      lastLoginAt: now,
    };

    await saveUser(user);

    const sessionId = createSession(user);
    setSessionCookie(res, sessionId);

    res.json(publicUser(user));
  } catch (err) {
    res.status(401).json({ error: err.message || "Authentication failed." });
  }
});

app.post("/api/auth/profile", requireAuth, async (req, res) => {
  const mobile = String(req.body.mobileNumber || "").trim();
  if (!/^[6-9]\d{9}$/.test(mobile)) {
    return res.status(400).json({ error: "Enter a valid 10-digit Indian mobile number." });
  }

  const user = {
    ...req.user,
    mobileNumber: mobile,
    updatedAt: new Date().toISOString(),
  };
  await saveUser(user);
  updateSessionUser(req, user);

  res.json(publicUser(user));
});

app.post("/api/auth/logout", (req, res) => {
  const cookies = parseCookies(req);
  if (cookies.career_dna_session) sessions.delete(cookies.career_dna_session);
  clearSessionCookie(res);
  res.json({ success: true });
});

app.get("/api/assessment", (req, res) => {
  const version = getAssessmentVersion(req.query.version);
  const filePath = path.join(ROOT, "data", ASSESSMENT_FILES[version]);
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  res.json(data);
});

app.get("/api/progress", requireAuth, async (req, res) => {
  try {
    const version = getAssessmentVersion(req.query.version);
    if (!supabase) return res.json(progressSessions.get(progressKey(req.user.email, version)) || null);

    const { data, error } = await supabase.from("assessment_progress")
      .select("student, answers, current_index, started_at, updated_at")
      .eq("student_email", req.user.email)
      .eq("assessment_version", version)
      .maybeSingle();
    if (error) throw error;
    res.json(data ? {
      student: data.student,
      answers: data.answers,
      currentIndex: data.current_index,
      startedAt: data.started_at,
      updatedAt: data.updated_at,
    } : null);
  } catch (err) {
    console.error("Could not load assessment progress:", err.message);
    res.status(500).json({ error: "Could not load assessment progress." });
  }
});

app.put("/api/progress", requireAuth, async (req, res) => {
  try {
    const { assessmentVersion, student, answers, currentIndex, startedAt } = req.body || {};
    const version = getAssessmentVersion(assessmentVersion);
    if (!student || !answers || !Number.isInteger(currentIndex) || !startedAt) {
      return res.status(400).json({ error: "Invalid assessment progress." });
    }

    const progress = { student, answers, currentIndex, startedAt, updatedAt: new Date().toISOString() };
    const updatedUser = {
      ...req.user,
      grade: String(student.grade || ""),
      school: String(student.school || ""),
      updatedAt: progress.updatedAt,
    };
    await saveUser(updatedUser);
    updateSessionUser(req, updatedUser);
    if (!supabase) {
      progressSessions.set(progressKey(req.user.email, version), progress);
      return res.json({ success: true, updatedAt: progress.updatedAt });
    }

    const { error } = await supabase.from("assessment_progress").upsert({
      student_email: req.user.email,
      assessment_version: version,
      student,
      answers,
      current_index: currentIndex,
      started_at: startedAt,
      updated_at: progress.updatedAt,
    });
    if (error) throw error;
    res.json({ success: true, updatedAt: progress.updatedAt });
  } catch (err) {
    console.error("Could not save assessment progress:", err.message);
    res.status(500).json({ error: progressStorageError(err) });
  }
});

app.delete("/api/progress", requireAuth, async (req, res) => {
  const version = getAssessmentVersion(req.query.version);
  progressSessions.delete(progressKey(req.user.email, version));
  if (supabase) {
    const { error } = await supabase.from("assessment_progress").delete().eq("student_email", req.user.email).eq("assessment_version", version);
    if (error) return res.status(500).json({ error: "Could not clear assessment progress." });
  }
  res.json({ success: true });
});

app.get("/api/results/latest", requireAuth, async (req, res) => {
  try {
    const version = getAssessmentVersion(req.query.version);
    if (!supabase) return res.json(null);

    const { data, error } = await supabase.from("assessment_results")
      .select("id, completed_at, created_at, result")
      .eq("student_email", req.user.email)
      .eq("assessment_version", version)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;

    res.json(data ? {
      id: data.id,
      completedAt: data.completed_at,
      savedAt: data.created_at,
      result: data.result,
    } : null);
  } catch (err) {
    console.error("Could not load latest assessment result:", err.message);
    res.status(500).json({ error: "Could not load the latest assessment result." });
  }
});

app.post("/api/submit", requireAuth, async (req, res) => {
  const result = req.body;
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const studentName = result?.student?.firstName || "student";
  const version = getAssessmentVersion(String(result.assessmentVersion || ""));
  const filename = `result-${studentName}-${timestamp}.json`;
  const resultsDir = path.join(ROOT, "results");

  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  result.submittedBy = {
    email: req.user.email,
    mobileNumber: req.user.mobileNumber,
  };

  if (supabase) {
    const { data, error } = await supabase.from("assessment_results").insert({
      student_email: req.user.email,
      assessment_version: version,
      completed_at: result.completedAt || null,
      result,
    }).select("id, created_at").single();
    if (error) return res.status(500).json({ error: "Could not save assessment result." });
    await supabase.from("assessment_progress").delete().eq("student_email", req.user.email).eq("assessment_version", version);
    return res.json({ success: true, resultId: data.id, savedAt: data.created_at });
  }

  progressSessions.delete(progressKey(req.user.email, version));
  fs.writeFileSync(path.join(resultsDir, filename), JSON.stringify(result, null, 2), "utf8");
  res.json({ success: true, filename, savedAt: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`CareerDNA Assessment running at http://localhost:${PORT}`);
  if (!GOOGLE_CLIENT_ID) {
    console.warn("Warning: GOOGLE_CLIENT_ID is not set. Google Sign-In will not work.");
  }
});
