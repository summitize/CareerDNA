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

  return findUser(session.email);
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

  res.json(publicUser(user));
});

app.post("/api/auth/logout", (req, res) => {
  const cookies = parseCookies(req);
  if (cookies.career_dna_session) sessions.delete(cookies.career_dna_session);
  clearSessionCookie(res);
  res.json({ success: true });
});

app.get("/api/assessment", (_req, res) => {
  const filePath = path.join(ROOT, "data", "assessment-v1.json");
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  res.json(data);
});

app.get("/api/progress", requireAuth, async (req, res) => {
  if (!supabase) return res.json(progressSessions.get(req.user.email) || null);

  const { data, error } = await supabase.from("assessment_progress")
    .select("student, answers, current_index, started_at, updated_at")
    .eq("student_email", req.user.email)
    .maybeSingle();
  if (error) return res.status(500).json({ error: "Could not load assessment progress." });
  res.json(data ? {
    student: data.student,
    answers: data.answers,
    currentIndex: data.current_index,
    startedAt: data.started_at,
    updatedAt: data.updated_at,
  } : null);
});

app.put("/api/progress", requireAuth, async (req, res) => {
  const { student, answers, currentIndex, startedAt } = req.body || {};
  if (!student || !answers || !Number.isInteger(currentIndex) || !startedAt) {
    return res.status(400).json({ error: "Invalid assessment progress." });
  }

  const progress = { student, answers, currentIndex, startedAt, updatedAt: new Date().toISOString() };
  if (!supabase) {
    progressSessions.set(req.user.email, progress);
    return res.json({ success: true, updatedAt: progress.updatedAt });
  }

  const { error } = await supabase.from("assessment_progress").upsert({
    student_email: req.user.email,
    student,
    answers,
    current_index: currentIndex,
    started_at: startedAt,
    updated_at: progress.updatedAt,
  });
  if (error) return res.status(500).json({ error: "Could not save assessment progress." });
  res.json({ success: true, updatedAt: progress.updatedAt });
});

app.delete("/api/progress", requireAuth, async (req, res) => {
  progressSessions.delete(req.user.email);
  if (supabase) {
    const { error } = await supabase.from("assessment_progress").delete().eq("student_email", req.user.email);
    if (error) return res.status(500).json({ error: "Could not clear assessment progress." });
  }
  res.json({ success: true });
});

app.post("/api/submit", requireAuth, async (req, res) => {
  const result = req.body;
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const studentName = result?.student?.firstName || "student";
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
      assessment_version: result.assessmentVersion || null,
      completed_at: result.completedAt || null,
      result,
    }).select("id, created_at").single();
    if (error) return res.status(500).json({ error: "Could not save assessment result." });
    await supabase.from("assessment_progress").delete().eq("student_email", req.user.email);
    return res.json({ success: true, resultId: data.id, savedAt: data.created_at });
  }

  progressSessions.delete(req.user.email);
  fs.writeFileSync(path.join(resultsDir, filename), JSON.stringify(result, null, 2), "utf8");
  res.json({ success: true, filename, savedAt: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`CareerDNA Assessment running at http://localhost:${PORT}`);
  if (!GOOGLE_CLIENT_ID) {
    console.warn("Warning: GOOGLE_CLIENT_ID is not set. Google Sign-In will not work.");
  }
});
