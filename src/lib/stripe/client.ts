import Stripe from "stripe";

import type { SubscriptionTier } from "@prisma/client";

import { getPrismaClient } from "@/lib/prisma";
import { getRequiredEnv } from "@/lib/utils";

export function getStripeClient() {
  return new Stripe(getRequiredEnv("STRIPE_SECRET_KEY"));
}

export const STRIPE_LOOKUP_KEYS: Record<Exclude<SubscriptionTier, "FREE">, string> = {
  STARTER: "soliddark_starter",
  GROWTH: "soliddark_growth",
  PROFESSIONAL: "soliddark_professional",
  ENTERPRISE: "soliddark_enterprise",
};

export async function getSubscriptionPriceByTier(tier: Exclude<SubscriptionTier, "FREE">) {
  const stripe = getStripeClient();
  const lookupKey = STRIPE_LOOKUP_KEYS[tier];
  const prices = await stripe.prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 1,
    expand: ["data.product"],
  });

  const price = prices.data[0];

  if (!price) {
    throw new Error(`Stripe price with lookup key "${lookupKey}" was not found. Create it in Stripe before using checkout.`);
  }

  return price;
}

export async function ensureStripeCustomer({
  userId,
  email,
  fullName,
  stripeCustomerId,
}: {
  userId: string;
  email: string;
  fullName: string | null;
  stripeCustomerId: string | null;
}) {
  const prisma = getPrismaClient();
  const stripe = getStripeClient();

  if (stripeCustomerId) {
    return stripeCustomerId;
  }

  const customer = await stripe.customers.create({
    email,
    name: fullName ?? undefined,
    metadata: {
      userId,
    },
  });

  await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      stripeCustomerId: customer.id,
    },
  });

  return customer.id;
}

export function stripeTierFromPrice(priceId: string): SubscriptionTier | null {
  const pricingMap = Object.entries(STRIPE_LOOKUP_KEYS) as Array<[Exclude<SubscriptionTier, "FREE">, string]>;

  for (const [tier] of pricingMap) {
    if (priceId.includes(tier.toLowerCase())) {
      return tier;
    }
  }

  return null;
}
