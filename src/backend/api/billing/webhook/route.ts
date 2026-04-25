import { type NextRequest } from "next/server";
import { applyStripeEvent, StripeError, verifyAndConstructEvent } from "@/backend/services/stripe.service";

// Stripe sends raw bytes. We need the unmodified body to verify the
// signature, so we do not call req.json() before constructEvent.
export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("missing signature", { status: 400 });

  const rawBody = await req.text();

  try {
    const event = await verifyAndConstructEvent(rawBody, signature);
    await applyStripeEvent(event);
    return new Response(null, { status: 204 });
  } catch (err) {
    if (err instanceof StripeError) {
      return new Response(err.message, { status: err.code === "bad_signature" ? 400 : 500 });
    }
    console.error("stripe webhook failed:", err);
    return new Response("internal error", { status: 500 });
  }
}
