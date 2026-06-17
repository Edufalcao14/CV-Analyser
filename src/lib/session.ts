import { cookies } from "next/headers";
import { COOKIE_NAME, verifySessionToken } from "./auth";

/** Server-side check: is the current request carrying a valid session cookie? */
export async function isAuthed(): Promise<boolean> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return false;
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  return !!token && verifySessionToken(token, secret);
}
