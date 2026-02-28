import type { NextRequest } from "next/server";

import type { SubscriptionTier } from "@prisma/client";

import { ensureStripeCustomer, getStripeClient, getSubscriptionPriceByTier } from "@/lib/stripe/client";
import { requireAuthenticatedAppUser } from "@/lib/supabase/server";
import { getRequiredEnv, jsonError } from "@/lib/utils";

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedAppUser();
    const body = (await request.json()) as { tier?: SubscriptionTier };
    const tier = body.tier;

    if (!tier || tier === "FREE") {
      return jsonError("A paid plan tier is required.", 400);
    }

    const stripe = getStripeClient();
    const price = await getSubscriptionPriceByTier(tier);
    const customerId = await ensureStripeCustomer({
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      stripeCustomerId: user.stripeCustomerId ?? null,
    });

    const appUrl = getRequiredEnv("NEXT_PUBLIC_APP_URL");
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
          price: price.id,
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/dashboard/settings/billing?checkout=success`,
      cancel_url: `${appUrl}/dashboard/settings/billing?checkout=cancelled`,
      metadata: {
        userId: user.id,
        tier,
      },
      subscription_data: {
        metadata: {
          userId: user.id,
          tier,
        },
      },
    });

    if (!session.url) {
      return jsonError("Stripe Checkout did not return a redirect URL.", 500);
    }

    return Response.json({ success: true, data: { url: session.url } });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to create Stripe Checkout session.", 500);
  }
}
