import { NextResponse, type NextRequest } from "next/server";
import { ApiKeyError, revokeKey } from "@/backend/services/api-key.service";
import { requireSession } from "@/backend/services/session.service";
import { badRequest, serverError, unauthorized } from "@/backend/utils/error-handler.util";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  let s;
  try {
    s = await requireSession();
  } catch {
    return unauthorized();
  }
  try {
    await revokeKey(s.org.id, params.id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof ApiKeyError) return badRequest(err.code, err.message);
    console.error("revokeKey failed:", err);
    return serverError();
  }
}
