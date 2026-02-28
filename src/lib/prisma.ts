import "server-only";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

declare global {
  var __soliddarkPrisma__: PrismaClient | undefined;
  var __soliddarkPrismaAdapter__: PrismaPg | undefined;
}

function getDatabaseUrl() {
  const value = process.env.DATABASE_URL;

  if (!value) {
    throw new Error("Missing required environment variable: DATABASE_URL");
  }

  return value;
}

export function getPrismaClient() {
  if (!global.__soliddarkPrisma__) {
    global.__soliddarkPrismaAdapter__ ??= new PrismaPg({
      connectionString: getDatabaseUrl(),
    });

    global.__soliddarkPrisma__ = new PrismaClient({
      adapter: global.__soliddarkPrismaAdapter__,
      log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    });
  }

  return global.__soliddarkPrisma__;
}
