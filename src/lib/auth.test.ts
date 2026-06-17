import { describe, it, expect } from "vitest";
import { createSessionToken, verifySessionToken, COOKIE_NAME } from "./auth";

const SECRET = "test-secret-please-change";
const HOUR = 60 * 60 * 1000;

describe("session token", () => {
  it("verifies a freshly issued token with the same secret", () => {
    const now = 1_000_000;
    const token = createSessionToken(SECRET, now, 24 * HOUR);
    expect(verifySessionToken(token, SECRET, now + HOUR)).toBe(true);
  });

  it("rejects a token signed with a different secret", () => {
    const now = 1_000_000;
    const token = createSessionToken(SECRET, now, 24 * HOUR);
    expect(verifySessionToken(token, "other-secret", now + HOUR)).toBe(false);
  });

  it("rejects a tampered token", () => {
    const now = 1_000_000;
    const token = createSessionToken(SECRET, now, 24 * HOUR);
    const tampered = token.slice(0, -2) + (token.endsWith("aa") ? "bb" : "aa");
    expect(verifySessionToken(tampered, SECRET, now + HOUR)).toBe(false);
  });

  it("rejects an expired token", () => {
    const now = 1_000_000;
    const token = createSessionToken(SECRET, now, 1 * HOUR);
    expect(verifySessionToken(token, SECRET, now + 2 * HOUR)).toBe(false);
  });

  it("rejects malformed input", () => {
    expect(verifySessionToken("", SECRET, Date.now())).toBe(false);
    expect(verifySessionToken("garbage", SECRET, Date.now())).toBe(false);
    expect(verifySessionToken("a.b.c", SECRET, Date.now())).toBe(false);
  });

  it("exposes a cookie name", () => {
    expect(typeof COOKIE_NAME).toBe("string");
    expect(COOKIE_NAME.length).toBeGreaterThan(0);
  });
});
