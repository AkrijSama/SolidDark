import { ensureStripeCustomer, getStripeClient } from "@/lib/stripe/client";
import { requireAuthenticatedAppUser } from "@/lib/supabase/server";
import { getRequiredEnv, jsonError, jsonOk } from "@/lib/utils";

export async function GET() {
  try {
    const { user } = await requireAuthenticatedAppUser();

    return jsonOk({
      tier: user.subscriptionTier,
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to load subscription tier.", 500);
  }
}

export async function POST() {
  try {
    const { user } = await requireAuthenticatedAppUser();
    const stripe = getStripeClient();
    const customerId = await ensureStripeCustomer({
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      stripeCustomerId: user.stripeCustomerId ?? null,
    });

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${getRequiredEnv("NEXT_PUBLIC_APP_URL")}/dashboard/settings/billing`,
    });

    return Response.json({
      success: true,
      data: {
        url: session.url,
      },
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to create billing portal session.", 500);
  }
}
