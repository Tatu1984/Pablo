import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/backend/utils/jwt.util";
import { userFromSession } from "@/backend/services/auth.service";
import type { Org, User } from "@/shared/types/user.types";

export async function currentSession(): Promise<{ user: User; org: Org } | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await verifySession(token);
  if (!session) return null;

  return userFromSession(session);
}

export async function requireSession(): Promise<{ user: User; org: Org }> {
  const s = await currentSession();
  if (!s) throw new Error("Not authenticated");
  return s;
}
