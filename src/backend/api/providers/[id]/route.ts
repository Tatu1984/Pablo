import { NextResponse, type NextRequest } from "next/server";
import {
  ProviderError,
  deleteProvider,
  updateProvider,
} from "@/backend/services/provider.service";
import { updateProviderSchema } from "@/backend/validators/provider.validator";
import { requireSession } from "@/backend/services/session.service";
import {
  badRequest,
  conflict,
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

  const parsed = updateProviderSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const provider = await updateProvider(session.org.id, params.id, parsed.data);
    return NextResponse.json({ provider });
  } catch (err) {
    if (err instanceof ProviderError) return badRequest(err.code, err.message);
    console.error("updateProvider failed:", err);
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
    await deleteProvider(session.org.id, params.id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof ProviderError) {
      if (err.code === "in_use") return conflict(err.code, err.message);
      return badRequest(err.code, err.message);
    }
    console.error("deleteProvider failed:", err);
    return serverError();
  }
}
