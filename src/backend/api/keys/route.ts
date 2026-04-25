import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { issueApiKey, listKeys } from "@/backend/services/api-key.service";
import { requireSession } from "@/backend/services/session.service";
import {
  badRequest,
  serverError,
  unauthorized,
  validationError,
} from "@/backend/utils/error-handler.util";

const issueSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export async function GET() {
  let s;
  try {
    s = await requireSession();
  } catch {
    return unauthorized();
  }
  const keys = await listKeys(s.org.id);
  return NextResponse.json({ keys });
}

export async function POST(req: NextRequest) {
  let s;
  try {
    s = await requireSession();
  } catch {
    return unauthorized();
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("invalid_body", "Request body must be JSON.");
  }
  const parsed = issueSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const { row, plaintext } = await issueApiKey(s.org.id, parsed.data.name, s.user.id);
    return NextResponse.json({ key: row, plaintext }, { status: 201 });
  } catch (err) {
    console.error("issueApiKey failed:", err);
    return serverError();
  }
}
