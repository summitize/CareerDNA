let googleClientId = null;
let gsiReady = null;

function waitForGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gsiReady) return gsiReady;

  gsiReady = new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (window.google?.accounts?.id) resolve();
      else if (Date.now() - start > 10000) reject(new Error("Google Sign-In failed to load."));
      else setTimeout(check, 100);
    };
    check();
  });

  return gsiReady;
}

export async function fetchAuthConfig() {
  const res = await fetch("/api/config");
  if (!res.ok) throw new Error("Auth is not configured. Run the Node server with Google credentials.");
  const config = await res.json();
  googleClientId = config.googleClientId;
  return config;
}

export async function getSession() {
  const res = await fetch("/api/auth/session");
  if (!res.ok) return null;
  return res.json();
}

export async function signInWithGoogle() {
  if (!googleClientId) await fetchAuthConfig();
  await waitForGoogleScript();

  return new Promise((resolve, reject) => {
    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: async (response) => {
        try {
          const res = await fetch("/api/auth/google", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ credential: response.credential }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            reject(new Error(err.error || "Google sign-in failed."));
            return;
          }
          resolve(await res.json());
        } catch (err) {
          reject(err);
        }
      },
      auto_select: false,
    });

    window.google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        const btn = document.getElementById("google-signin-btn");
        if (btn) {
          window.google.accounts.id.renderButton(btn, {
            theme: "outline",
            size: "large",
            width: 320,
            text: "signin_with",
            shape: "rectangular",
          });
        }
      }
    });
  });
}

export async function saveMobileNumber(mobileNumber) {
  const res = await fetch("/api/auth/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mobileNumber }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Could not save mobile number.");
  }
  return res.json();
}

export async function logout() {
  await fetch("/api/auth/logout", { method: "POST" });
}
