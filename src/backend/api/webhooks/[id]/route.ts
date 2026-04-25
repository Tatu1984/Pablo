import { NextResponse, type NextRequest } from "next/server";
import { removeWebhook, WebhookError } from "@/backend/services/webhook.service";
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
    await removeWebhook(s.org.id, params.id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof WebhookError) return badRequest(err.code, err.message);
    console.error("removeWebhook failed:", err);
    return serverError();
  }
}
