import { NextResponse, type NextRequest } from "next/server";
import { AgentError, createAgent } from "@/backend/services/agent.service";
import { createAgentSchema } from "@/backend/validators/agent.validator";
import { requireSession } from "@/backend/services/session.service";
import {
  badRequest,
  serverError,
  unauthorized,
  validationError,
} from "@/backend/utils/error-handler.util";

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return unauthorized();
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("invalid_body", "Request body must be JSON.");
  }

  const parsed = createAgentSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const agent = await createAgent(session.org.id, parsed.data);
    return NextResponse.json({ agent }, { status: 201 });
  } catch (err) {
    if (err instanceof AgentError) {
      return badRequest(err.code, err.message);
    }
    console.error("createAgent failed:", err);
    return serverError();
  }
}
