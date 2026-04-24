import { NextResponse, type NextRequest } from "next/server";
import { AuthError, login } from "@/backend/services/auth.service";
import { loginSchema } from "@/backend/validators/auth.validator";
import {
  badRequest,
  serverError,
  unauthorized,
  validationError,
} from "@/backend/utils/error-handler.util";
import { SESSION_COOKIE, SESSION_COOKIE_MAX_AGE } from "@/backend/utils/jwt.util";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("invalid_body", "Request body must be JSON.");
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const { user, org, token } = await login(parsed.data);
    const res = NextResponse.json({ user, org });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_COOKIE_MAX_AGE,
    });
    return res;
  } catch (err) {
    if (err instanceof AuthError && err.code === "invalid_credentials") {
      return unauthorized("invalid_credentials", err.message);
    }
    console.error("login failed:", err);
    return serverError();
  }
}
