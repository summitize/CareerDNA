require("dotenv").config();

const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3456;
const ROOT = __dirname;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const SESSION_SECRET = process.env.SESSION_SECRET || "change-me-in-production";
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const usersFile = path.join(ROOT, "data", "users.json");
const sessions = new Map();

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

function createSession(user) {
  const sessionId = crypto.randomBytes(32).toString("hex");
  sessions.set(sessionId, {
    email: user.email,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_MAX_AGE_MS,
  });
  return sessionId;
}

function getSessionUser(req) {
  const cookies = parseCookies(req);
  const sessionId = cookies.career_dna_session;
  if (!sessionId) return null;

  const session = sessions.get(sessionId);
  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(sessionId);
    return null;
  }

  const users = readUsers();
  return users[session.email] || null;
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

function requireAuth(req, res, next) {
  const user = getSessionUser(req);
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

app.get("/api/auth/session", (req, res) => {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ error: "Not authenticated." });
  res.json(publicUser(user));
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
    const users = readUsers();
    const existing = users[email];
    const now = new Date().toISOString();

    users[email] = {
      email,
      name: payload.name || existing?.name || email,
      picture: payload.picture || existing?.picture || "",
      googleSub: payload.sub,
      mobileNumber: existing?.mobileNumber || "",
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      lastLoginAt: now,
    };

    writeUsers(users);

    const sessionId = createSession(users[email]);
    setSessionCookie(res, sessionId);

    res.json(publicUser(users[email]));
  } catch (err) {
    res.status(401).json({ error: err.message || "Authentication failed." });
  }
});

app.post("/api/auth/profile", requireAuth, (req, res) => {
  const mobile = String(req.body.mobileNumber || "").trim();
  if (!/^[6-9]\d{9}$/.test(mobile)) {
    return res.status(400).json({ error: "Enter a valid 10-digit Indian mobile number." });
  }

  const users = readUsers();
  const email = req.user.email;
  users[email] = {
    ...users[email],
    mobileNumber: mobile,
    updatedAt: new Date().toISOString(),
  };
  writeUsers(users);

  res.json(publicUser(users[email]));
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

app.post("/api/submit", requireAuth, (req, res) => {
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

  fs.writeFileSync(path.join(resultsDir, filename), JSON.stringify(result, null, 2), "utf8");
  res.json({ success: true, filename, savedAt: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`CareerDNA Assessment running at http://localhost:${PORT}`);
  if (!GOOGLE_CLIENT_ID) {
    console.warn("Warning: GOOGLE_CLIENT_ID is not set. Google Sign-In will not work.");
  }
});
