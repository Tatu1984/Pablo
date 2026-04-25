import { NextResponse, type NextRequest } from "next/server";
import { resolveRequestAuth, type RequestContext } from "@/backend/services/v1-auth.service";

const PROBLEM_HEADERS = { "Content-Type": "application/problem+json" };

export async function withV1Auth(
  req: NextRequest,
): Promise<{ ctx: RequestContext } | { error: NextResponse }> {
  const ctx = await resolveRequestAuth(req);
  if (!ctx) {
    return {
      error: NextResponse.json(
        {
          type: "https://docs.pablo.ai/errors/unauthorized",
          title: "Unauthorized",
          status: 401,
          code: "unauthorized",
          detail:
            "Missing or invalid credentials. Send Authorization: Bearer sk_live_…",
        },
        { status: 401, headers: PROBLEM_HEADERS },
      ),
    };
  }
  return { ctx };
}
