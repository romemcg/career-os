import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { SESSION_COOKIE } from "./constants";
import { type AuthContext, validateSession } from "./session";

/** For server components: resolve the owner session or redirect to login. */
export async function requireOwner(): Promise<AuthContext> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const auth = await validateSession(getDb(), token);
  if (!auth) redirect("/login");
  return auth;
}

export async function currentOwner(): Promise<AuthContext | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return validateSession(getDb(), token);
}
