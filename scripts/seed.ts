import { AIProvider, HeirAccessLevel, ServiceType, SubscriptionTier } from "@prisma/client";

import { encrypt } from "../src/lib/crypto/vault";
import { getPrismaClient } from "../src/lib/prisma";

async function main() {
  const prisma = getPrismaClient();

  const user = await prisma.user.upsert({
    where: {
      email: "demo@soliddark.local",
    },
    update: {},
    create: {
      email: "demo@soliddark.local",
      fullName: "SolidDark Demo",
      supabaseId: "demo-supabase-id",
      subscriptionTier: SubscriptionTier.PROFESSIONAL,
      jurisdictions: ["US-FL", "US-CA"],
      aiProvider: AIProvider.CLAUDE_API,
    },
  });

  const vaultPayload = {
    username: "demo@soliddark.local",
    password: "replace-me",
    notes: "Seed credential for local development.",
  };
  const encryptedVault = encrypt(JSON.stringify(vaultPayload));

  await prisma.vaultEntry.upsert({
    where: {
      id: "seed-vault-entry",
    },
    update: {
      serviceName: "Supabase",
      serviceType: ServiceType.DATABASE,
      encryptedData: encryptedVault.encrypted,
      nonce: encryptedVault.nonce,
      accessibleBy: [],
      lastRotated: new Date(),
    },
    create: {
      id: "seed-vault-entry",
      userId: user.id,
      serviceName: "Supabase",
      serviceType: ServiceType.DATABASE,
      encryptedData: encryptedVault.encrypted,
      nonce: encryptedVault.nonce,
      accessibleBy: [],
      lastRotated: new Date(),
    },
  });

  const existingHeir = await prisma.heir.findFirst({
    where: {
      userId: user.id,
      email: "heir@soliddark.local",
    },
  });

  if (!existingHeir) {
    await prisma.heir.create({
      data: {
        userId: user.id,
        fullName: "Continuity Heir",
        email: "heir@soliddark.local",
        relationship: "Business partner",
        accessLevel: HeirAccessLevel.OPERATIONAL,
        notificationOrder: 1,
      },
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error("Seed failed.", error);
    process.exit(1);
  })
  .finally(async () => {
    await getPrismaClient().$disconnect();
  });
