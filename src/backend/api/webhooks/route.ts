import { NextResponse, type NextRequest } from "next/server";
import { createWebhookSchema } from "@/backend/validators/webhook.validator";
import {
  listAllWebhooks,
  listRecentDeliveries,
  registerWebhook,
  WebhookError,
} from "@/backend/services/webhook.service";
import { requireSession } from "@/backend/services/session.service";
import {
  badRequest,
  serverError,
  unauthorized,
  validationError,
} from "@/backend/utils/error-handler.util";

export async function GET() {
  let s;
  try {
    s = await requireSession();
  } catch {
    return unauthorized();
  }
  const [webhooks, deliveries] = await Promise.all([
    listAllWebhooks(s.org.id),
    listRecentDeliveries(s.org.id),
  ]);
  return NextResponse.json({ webhooks, deliveries });
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
  const parsed = createWebhookSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const { row, secret } = await registerWebhook(
      s.org.id,
      parsed.data.url,
      parsed.data.events,
    );
    return NextResponse.json({ webhook: row, secret }, { status: 201 });
  } catch (err) {
    if (err instanceof WebhookError) return badRequest(err.code, err.message);
    console.error("registerWebhook failed:", err);
    return serverError();
  }
}
