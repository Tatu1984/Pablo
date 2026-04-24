import { NextResponse, type NextRequest } from "next/server";
import { AgentError, archiveAgent, updateAgent } from "@/backend/services/agent.service";
import { updateAgentSchema } from "@/backend/validators/agent.validator";
import { requireSession } from "@/backend/services/session.service";
import {
  badRequest,
  serverError,
  unauthorized,
  validationError,
} from "@/backend/utils/error-handler.util";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
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

  const parsed = updateAgentSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const agent = await updateAgent(session.org.id, params.id, parsed.data);
    return NextResponse.json({ agent });
  } catch (err) {
    if (err instanceof AgentError) return badRequest(err.code, err.message);
    console.error("updateAgent failed:", err);
    return serverError();
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return unauthorized();
  }

  try {
    await archiveAgent(session.org.id, params.id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof AgentError) return badRequest(err.code, err.message);
    console.error("archiveAgent failed:", err);
    return serverError();
  }
}
