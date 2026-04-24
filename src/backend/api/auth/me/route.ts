import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/backend/utils/jwt.util";
import { userFromSession } from "@/backend/services/auth.service";
import { unauthorized } from "@/backend/utils/error-handler.util";

export async function GET() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return unauthorized();

  const session = await verifySession(token);
  if (!session) return unauthorized("invalid_session", "Session is invalid or expired.");

  const hydrated = await userFromSession(session);
  if (!hydrated) return unauthorized("invalid_session", "Session no longer valid.");

  return NextResponse.json(hydrated);
}
