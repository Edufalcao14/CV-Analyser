import crypto from "node:crypto";

/**
 * Minimal signed-session-token helper for the shared-password gate.
 *
 * The user enters the shared password once; on success the server sets an
 * HttpOnly + Secure + SameSite cookie holding one of these tokens (NOT the raw
 * password). The browser re-sends it automatically, so the user never retypes —
 * and because the cookie is HttpOnly it is invisible to JavaScript (unlike
 * localStorage, which any XSS could read).
 *
 * Token format: `<expiryMs>.<base64url-hmac>` where the HMAC is over the expiry.
 */

export const COOKIE_NAME = "cv_session";
export const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Shared cookie attributes for set (login) and clear (logout), so the two paths
 * can't drift apart. HttpOnly keeps the token out of JS; Secure is on in prod only
 * (localhost is http). `maxAge` of 0 clears the cookie.
 */
export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

function sign(value: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

export function createSessionToken(
  secret: string,
  now: number = Date.now(),
  ttlMs: number = DEFAULT_TTL_MS,
): string {
  const exp = String(now + ttlMs);
  return `${exp}.${sign(exp, secret)}`;
}

export function verifySessionToken(
  token: string,
  secret: string,
  now: number = Date.now(),
): boolean {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [exp, sig] = parts;
  if (!/^\d+$/.test(exp)) return false;

  const expected = sign(exp, secret);
  // Constant-time comparison to avoid leaking signature info via timing.
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return false;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return false;

  return Number(exp) > now;
}
