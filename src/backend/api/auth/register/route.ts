import { NextResponse, type NextRequest } from "next/server";
import { AuthError, register } from "@/backend/services/auth.service";
import { registerSchema } from "@/backend/validators/auth.validator";
import {
  badRequest,
  conflict,
  serverError,
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

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const { user, org, token } = await register(parsed.data);
    const res = NextResponse.json({ user, org }, { status: 201 });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_COOKIE_MAX_AGE,
    });
    return res;
  } catch (err) {
    if (err instanceof AuthError && err.code === "email_taken") {
      return conflict("email_taken", err.message);
    }
    console.error("register failed:", err);
    return serverError();
  }
}
