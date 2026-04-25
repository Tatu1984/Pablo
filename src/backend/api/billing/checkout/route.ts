import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireSession } from "@/backend/services/session.service";
import { createCheckoutSession, StripeError } from "@/backend/services/stripe.service";
import { badRequest, serverError, unauthorized, validationError } from "@/backend/utils/error-handler.util";

const bodySchema = z.object({ plan: z.enum(["pro"]) });

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
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const { url } = await createCheckoutSession({
      orgId: session.org.id,
      email: session.user.email,
      plan: parsed.data.plan,
      appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    });
    return NextResponse.json({ url });
  } catch (err) {
    if (err instanceof StripeError) return badRequest(err.code, err.message);
    console.error("createCheckoutSession failed:", err);
    return serverError();
  }
}
