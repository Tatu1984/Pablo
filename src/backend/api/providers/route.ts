import { NextResponse, type NextRequest } from "next/server";
import { createProvider } from "@/backend/services/provider.service";
import { createProviderSchema } from "@/backend/validators/provider.validator";
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

  const parsed = createProviderSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const provider = await createProvider(session.org.id, parsed.data);
    return NextResponse.json({ provider }, { status: 201 });
  } catch (err) {
    console.error("createProvider failed:", err);
    return serverError();
  }
}
