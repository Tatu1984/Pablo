import { NextResponse } from "next/server";
import { requireSession } from "@/backend/services/session.service";
import { createPortalSession, StripeError } from "@/backend/services/stripe.service";
import { badRequest, serverError, unauthorized } from "@/backend/utils/error-handler.util";

export async function POST() {
  let session;
  try {
    session = await requireSession();
  } catch {
    return unauthorized();
  }

  try {
    const { url } = await createPortalSession(
      session.org.id,
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    );
    return NextResponse.json({ url });
  } catch (err) {
    if (err instanceof StripeError) return badRequest(err.code, err.message);
    console.error("createPortalSession failed:", err);
    return serverError();
  }
}
