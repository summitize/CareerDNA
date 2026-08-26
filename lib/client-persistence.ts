/**
 * Durable client-side persistence.
 *
 * Mirrors the strategy used by CareerDNACursor/js/app.js: important client
 * state (selected theme, in-progress assessment answers) is written to BOTH
 * localStorage and a long-lived cookie:
 *  - localStorage gives instant per-browser reads and holds larger payloads;
 *  - the cookie keeps the state durable for a year and survives localStorage
 *    being cleared by the user or by browser maintenance/cleanup policies.
 */

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** Browsers reject cookies larger than ~4KB; stay safely under the limit. */
const MAX_COOKIE_LENGTH = 3800;

/** Write a persistent cookie (retained ~1 year, site-wide). */
export function setCookie(name: string, value: string): void {
  try {
    const encoded = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; max-age=${ONE_YEAR_SECONDS}; path=/; SameSite=Lax`;
    if (encoded.length > MAX_COOKIE_LENGTH) return; // too big for a cookie — localStorage copy still persists it
    document.cookie = encoded;
  } catch {
    // Cookies unavailable — the localStorage copy still holds the value.
  }
}

/** Read a persistent cookie, or null when absent/unavailable. */
export function getCookie(name: string): string | null {
  try {
    const prefix = `${encodeURIComponent(name)}=`;
    const row = document.cookie
      .split("; ")
      .find((entry) => entry.startsWith(prefix));
    return row ? decodeURIComponent(row.slice(prefix.length)) : null;
  } catch {
    return null;
  }
}

/** Read a saved value: prefer localStorage, fall back to the durable cookie. */
export function readSaved(key: string): string | null {
  try {
    const local = window.localStorage.getItem(key);
    if (local !== null) return local;
  } catch {
    // fall through to the cookie copy
  }
  return getCookie(key);
}

/** Save a value durably: update localStorage and refresh the retained cookie. */
export function saveDurable(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // fall through — the cookie copy still persists the value
  }
  setCookie(key, value);
}
