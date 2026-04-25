import { NextResponse, type NextRequest } from "next/server";
import { testWebhook, WebhookError } from "@/backend/services/webhook.service";
import { requireSession } from "@/backend/services/session.service";
import { badRequest, serverError, unauthorized } from "@/backend/utils/error-handler.util";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  let s;
  try {
    s = await requireSession();
  } catch {
    return unauthorized();
  }
  try {
    const result = await testWebhook(s.org.id, params.id);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof WebhookError) return badRequest(err.code, err.message);
    console.error("testWebhook failed:", err);
    return serverError();
  }
}
