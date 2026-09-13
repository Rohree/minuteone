import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser, SESSION_COOKIE } from "./session";
import type { UserRow } from "../db/schema";

/** Server-only — reads the session cookie via next/headers, so only callable in server components/routes. */
export async function getCurrentUser(): Promise<UserRow | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return getSessionUser(token);
}

/** Use at the top of every app/dashboard/**\/page.tsx (and layout.tsx) that requires a signed-in user. */
export async function requireUser(): Promise<UserRow> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
