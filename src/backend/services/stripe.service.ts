// Thin Stripe layer. All entry points return a typed result so callers
// stay UI-friendly even when the env isn't configured. We deliberately
// don't import the Stripe SDK at module top-level — it's heavy and most
// requests don't touch billing.

import { findOrgIdByStripeCustomer, getSubscription, setSubscriptionPlan } from "@/backend/repositories/subscription.repository";
import type { Stripe as StripeNS } from "stripe";
import type { PlanId } from "@/shared/constants/plans";
import { planFor, PLANS } from "@/shared/constants/plans";

declare global {
  var __stripe: StripeNS | undefined;
}

async function getStripe(): Promise<StripeNS | null> {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!global.__stripe) {
    const mod = await import("stripe");
    const Stripe = (mod.default ?? mod) as unknown as new (
      k: string,
      c?: Record<string, unknown>,
    ) => StripeNS;
    // Use the Stripe account's active API version unless STRIPE_API_VERSION
    // is set explicitly.
    const config: Record<string, unknown> = {};
    if (process.env.STRIPE_API_VERSION) {
      config.apiVersion = process.env.STRIPE_API_VERSION;
    }
    global.__stripe = new Stripe(process.env.STRIPE_SECRET_KEY, config);
  }
  return global.__stripe;
}

export class StripeError extends Error {
  constructor(
    public code:
      | "stripe_unconfigured"
      | "no_price_for_plan"
      | "no_customer"
      | "bad_signature"
      | "upstream",
    message: string,
  ) {
    super(message);
  }
}

export interface CheckoutInput {
  orgId: string;
  email: string;
  plan: PlanId;
  appUrl: string;
}

export async function createCheckoutSession(
  input: CheckoutInput,
): Promise<{ url: string }> {
  const stripe = await getStripe();
  if (!stripe) {
    throw new StripeError(
      "stripe_unconfigured",
      "Stripe is not configured on this deployment.",
    );
  }
  const plan = planFor(input.plan);
  const priceEnv = plan.stripe_price_env;
  const priceId = priceEnv ? process.env[priceEnv] : null;
  if (!priceId) {
    throw new StripeError(
      "no_price_for_plan",
      `No Stripe price configured for plan "${plan.id}". Set ${priceEnv ?? "STRIPE_PRICE_*"} in env.`,
    );
  }

  const sub = await getSubscription(input.orgId);
  const customer = sub?.stripe_customer_id ?? undefined;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    customer,
    customer_email: customer ? undefined : input.email,
    success_url: `${input.appUrl}/billing?upgraded=1`,
    cancel_url: `${input.appUrl}/billing`,
    subscription_data: {
      metadata: { org_id: input.orgId, plan: plan.id },
    },
    metadata: { org_id: input.orgId, plan: plan.id },
  });

  if (!session.url) {
    throw new StripeError("upstream", "Stripe did not return a checkout URL.");
  }
  return { url: session.url };
}

export async function createPortalSession(
  orgId: string,
  appUrl: string,
): Promise<{ url: string }> {
  const stripe = await getStripe();
  if (!stripe) {
    throw new StripeError(
      "stripe_unconfigured",
      "Stripe is not configured on this deployment.",
    );
  }
  const sub = await getSubscription(orgId);
  if (!sub?.stripe_customer_id) {
    throw new StripeError(
      "no_customer",
      "No Stripe customer on file for this org. Run a checkout first.",
    );
  }
  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${appUrl}/billing`,
  });
  return { url: session.url };
}

// ─── Webhook ────────────────────────────────────────────────────────────────

export async function verifyAndConstructEvent(
  rawBody: string,
  signature: string,
): Promise<StripeNS.Event> {
  const stripe = await getStripe();
  if (!stripe) {
    throw new StripeError(
      "stripe_unconfigured",
      "Stripe is not configured on this deployment.",
    );
  }
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new StripeError(
      "stripe_unconfigured",
      "STRIPE_WEBHOOK_SECRET is not set.",
    );
  }
  try {
    return stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    throw new StripeError(
      "bad_signature",
      err instanceof Error ? err.message : "Bad signature",
    );
  }
}

// Apply the side-effects of an inbound event. Idempotent — running the
// same event twice is safe.
export async function applyStripeEvent(event: StripeNS.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as StripeNS.Checkout.Session;
      const orgId = (session.metadata as Record<string, string> | null)?.org_id;
      const plan = (session.metadata as Record<string, string> | null)?.plan as PlanId | undefined;
      if (!orgId) return;
      await setSubscriptionPlan(orgId, {
        plan: plan && PLANS[plan] ? plan : "pro",
        status: "active",
        stripe_customer_id: typeof session.customer === "string" ? session.customer : null,
        stripe_sub_id:
          typeof session.subscription === "string" ? session.subscription : null,
      });
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.created": {
      const sub = event.data.object as StripeNS.Subscription;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      const orgId = await findOrgIdByStripeCustomer(customerId);
      if (!orgId) return;
      const plan = (sub.metadata as Record<string, string> | null)?.plan as PlanId | undefined;
      // current_period_end moved between Stripe API versions — read it
      // defensively from either the subscription itself or its first item.
      const subAny = sub as unknown as { current_period_end?: number };
      const item = (sub.items?.data?.[0] as unknown as { current_period_end?: number } | undefined);
      const periodEndUnix = subAny.current_period_end ?? item?.current_period_end;
      await setSubscriptionPlan(orgId, {
        plan: plan && PLANS[plan] ? plan : undefined,
        status: sub.status,
        stripe_customer_id: customerId,
        stripe_sub_id: sub.id,
        current_period_end: periodEndUnix ? new Date(periodEndUnix * 1000) : null,
      });
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as StripeNS.Subscription;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      const orgId = await findOrgIdByStripeCustomer(customerId);
      if (!orgId) return;
      await setSubscriptionPlan(orgId, {
        plan: "starter",
        status: "canceled",
        stripe_sub_id: null,
        current_period_end: null,
      });
      break;
    }
    default:
      // Plenty of event types we don't care about — ignore them.
      break;
  }
}
