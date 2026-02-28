import Stripe from "stripe";

import { getPrismaClient } from "@/lib/prisma";
import { getRequiredEnv, jsonError, jsonOk } from "@/lib/utils";
import { getStripeClient, STRIPE_LOOKUP_KEYS } from "@/lib/stripe/client";

function tierFromLineItemPriceId(priceId?: string | null) {
  if (!priceId) {
    return "FREE" as const;
  }

  if (priceId.includes(STRIPE_LOOKUP_KEYS.STARTER.replace("soliddark_", ""))) {
    return "STARTER" as const;
  }
  if (priceId.includes(STRIPE_LOOKUP_KEYS.GROWTH.replace("soliddark_", ""))) {
    return "GROWTH" as const;
  }
  if (priceId.includes(STRIPE_LOOKUP_KEYS.PROFESSIONAL.replace("soliddark_", ""))) {
    return "PROFESSIONAL" as const;
  }
  if (priceId.includes(STRIPE_LOOKUP_KEYS.ENTERPRISE.replace("soliddark_", ""))) {
    return "ENTERPRISE" as const;
  }

  return "FREE" as const;
}

async function updateUserTierByCustomer(customerId: string, tier: "FREE" | "STARTER" | "GROWTH" | "PROFESSIONAL" | "ENTERPRISE") {
  const prisma = getPrismaClient();

  await prisma.user.updateMany({
    where: {
      stripeCustomerId: customerId,
    },
    data: {
      subscriptionTier: tier,
    },
  });
}

export async function POST(request: Request) {
  const stripe = getStripeClient();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return jsonError("Missing Stripe signature.", 400);
  }

  try {
    const rawBody = await request.text();
    const event = stripe.webhooks.constructEvent(rawBody, signature, getRequiredEnv("STRIPE_WEBHOOK_SECRET"));

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.customer) {
          const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
          const priceId = lineItems.data[0]?.price?.id ?? null;
          await updateUserTierByCustomer(String(session.customer), tierFromLineItemPriceId(priceId));
        }
        break;
      }
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = String(subscription.customer);
        const priceId = subscription.items.data[0]?.price.id ?? null;
        await updateUserTierByCustomer(customerId, tierFromLineItemPriceId(priceId));
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await updateUserTierByCustomer(String(subscription.customer), "FREE");
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.customer) {
          await updateUserTierByCustomer(String(invoice.customer), "FREE");
        }
        break;
      }
      default:
        break;
    }

    return jsonOk({ received: true });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Stripe webhook processing failed.", 400);
  }
}
