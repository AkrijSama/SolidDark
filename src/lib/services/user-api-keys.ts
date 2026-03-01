import type { AIProvider } from "@prisma/client";

import { decrypt, encrypt } from "@/lib/crypto/vault";
import { prisma } from "@/lib/prisma";

export async function storeUserApiKey(
  userId: string,
  provider: AIProvider,
  apiKey: string,
): Promise<{ keyPrefix: string }> {
  if (!userId) {
    throw new Error("storeUserApiKey requires a userId.");
  }

  if (provider === "CLAUDE_API" && !apiKey.startsWith("sk-ant-")) {
    throw new Error("Invalid Anthropic API key format. Must start with 'sk-ant-'");
  }

  if (provider === "OPENAI_API" && !apiKey.startsWith("sk-")) {
    throw new Error("Invalid OpenAI API key format. Must start with 'sk-'");
  }

  if (provider === "LOCAL_LLM") {
    throw new Error("Local LLM does not support storing a remote API key.");
  }

  try {
    const { encrypted, nonce } = encrypt(apiKey);
    const keyPrefix = `${apiKey.substring(0, 10)}...`;

    await prisma.userApiKey.upsert({
      where: { userId_provider: { userId, provider } },
      create: {
        userId,
        provider,
        encryptedKey: encrypted,
        nonce,
        keyPrefix,
        isValid: true,
      },
      update: {
        encryptedKey: encrypted,
        nonce,
        keyPrefix,
        isValid: true,
        updatedAt: new Date(),
      },
    });

    return { keyPrefix };
  } catch (error) {
    throw new Error(`Failed to store user API key. ${error instanceof Error ? error.message : "Unknown storage error."}`);
  }
}

export async function getUserApiKey(userId: string, provider: AIProvider): Promise<string | null> {
  if (!userId) {
    throw new Error("getUserApiKey requires a userId.");
  }

  try {
    const record = await prisma.userApiKey.findUnique({
      where: { userId_provider: { userId, provider } },
    });

    if (!record || !record.isValid) {
      return null;
    }

    const decrypted = decrypt(record.encryptedKey, record.nonce);

    await prisma.userApiKey.update({
      where: { id: record.id },
      data: { lastUsed: new Date() },
    });

    return decrypted;
  } catch (error) {
    console.error(`Failed to decrypt API key for user ${userId}, provider ${provider}:`, error);
    return null;
  }
}

export async function invalidateUserApiKey(userId: string, provider: AIProvider): Promise<void> {
  if (!userId) {
    throw new Error("invalidateUserApiKey requires a userId.");
  }

  try {
    await prisma.userApiKey.updateMany({
      where: { userId, provider },
      data: { isValid: false },
    });
  } catch (error) {
    throw new Error(`Failed to invalidate user API key. ${error instanceof Error ? error.message : "Unknown update error."}`);
  }
}

export async function deleteUserApiKey(userId: string, provider: AIProvider): Promise<void> {
  if (!userId) {
    throw new Error("deleteUserApiKey requires a userId.");
  }

  try {
    await prisma.userApiKey.deleteMany({
      where: { userId, provider },
    });
  } catch (error) {
    throw new Error(`Failed to delete user API key. ${error instanceof Error ? error.message : "Unknown delete error."}`);
  }
}

export async function hasValidUserApiKey(userId: string, provider: AIProvider): Promise<boolean> {
  if (!userId) {
    throw new Error("hasValidUserApiKey requires a userId.");
  }

  try {
    const record = await prisma.userApiKey.findUnique({
      where: { userId_provider: { userId, provider } },
    });

    return !!record && record.isValid;
  } catch (error) {
    throw new Error(`Failed to check for a valid user API key. ${error instanceof Error ? error.message : "Unknown lookup error."}`);
  }
}

export async function listUserApiKeys(userId: string) {
  if (!userId) {
    throw new Error("listUserApiKeys requires a userId.");
  }

  try {
    return await prisma.userApiKey.findMany({
      where: { userId },
      select: {
        id: true,
        provider: true,
        keyPrefix: true,
        isValid: true,
        lastUsed: true,
        lastValidated: true,
        createdAt: true,
      },
    });
  } catch (error) {
    throw new Error(`Failed to list user API keys. ${error instanceof Error ? error.message : "Unknown lookup error."}`);
  }
}
