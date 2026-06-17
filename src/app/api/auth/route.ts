import { NextResponse } from "next/server";
import {
  COOKIE_NAME,
  DEFAULT_TTL_MS,
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/auth";
import { isAuthed } from "@/lib/session";

export const runtime = "nodejs";

/** GET → whether the caller is currently authenticated. */
export async function GET() {
  return NextResponse.json({ authed: await isAuthed() });
}

/** POST { password } → set the HttpOnly session cookie on success. */
export async function POST(req: Request) {
  const expected = process.env.APP_PASSWORD;
  const secret = process.env.AUTH_SECRET;
  if (!expected || !secret) {
    return NextResponse.json(
      { error: "Server is missing APP_PASSWORD / AUTH_SECRET configuration." },
      { status: 500 },
    );
  }

  let password: unknown;
  try {
    password = (await req.json())?.password;
  } catch {
    password = undefined;
  }

  if (typeof password !== "string" || password !== expected) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(
    COOKIE_NAME,
    createSessionToken(secret),
    sessionCookieOptions(Math.floor(DEFAULT_TTL_MS / 1000)),
  );
  return res;
}

/** DELETE → log out (clear the cookie). */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, "", sessionCookieOptions(0));
  return res;
}
