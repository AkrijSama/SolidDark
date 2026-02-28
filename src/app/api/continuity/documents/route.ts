import Anthropic from "@anthropic-ai/sdk";
import type { NextRequest } from "next/server";
import { DocumentType, Prisma } from "@prisma/client";

import { DOC_GENERATE_PROMPT } from "@/lib/ai/prompts/doc-generate";
import { requireAuthenticatedAppUser } from "@/lib/supabase/server";
import { getPrismaClient } from "@/lib/prisma";
import { createApiError, getRequiredEnv, jsonError, jsonOk } from "@/lib/utils";

export async function GET() {
  try {
    const prisma = getPrismaClient();
    const { user } = await requireAuthenticatedAppUser();

    const documents = await prisma.generatedDocument.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return jsonOk(
      documents.map((document) => ({
        id: document.id,
        documentType: document.documentType,
        title: document.title,
        content: document.content,
        jurisdiction: document.jurisdiction,
        createdAt: document.createdAt.toISOString(),
      })),
    );
  } catch (error) {
    return jsonError(createApiError(error, "Unable to load generated documents."), 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const prisma = getPrismaClient();
    const { user } = await requireAuthenticatedAppUser();
    const body = (await request.json()) as {
      documentType?: DocumentType;
      context?: Record<string, unknown>;
    };

    if (!body.documentType || !Object.values(DocumentType).includes(body.documentType)) {
      return jsonError("Document type is required.", 400);
    }

    const context = body.context ?? {};
    const jurisdiction = user.jurisdictions[0] ?? "US-FL";
    const anthropic = new Anthropic({
      apiKey: getRequiredEnv("ANTHROPIC_API_KEY"),
    });

    const response = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 1800,
      temperature: 0.2,
      system: DOC_GENERATE_PROMPT,
      messages: [
        {
          role: "user",
          content: `
            Jurisdiction: ${jurisdiction}
            Document type: ${body.documentType}
            Context: ${JSON.stringify(context, null, 2)}

            Generate a complete document in markdown. Include practical steps, plain-language clauses, and a final note that a licensed attorney should review the document before use.
          `,
        },
      ],
    });

    const content = response.content
      .filter((item) => item.type === "text")
      .map((item) => item.text)
      .join("\n\n")
      .trim();

    if (!content) {
      throw new Error("Document generation returned empty content.");
    }

    const document = await prisma.generatedDocument.create({
      data: {
        userId: user.id,
        documentType: body.documentType,
        title: body.documentType.replaceAll("_", " "),
        content,
        jurisdiction,
        metadata: context as Prisma.InputJsonValue,
      },
    });

    return jsonOk({
      id: document.id,
      documentType: document.documentType,
      title: document.title,
      content: document.content,
      jurisdiction: document.jurisdiction,
      createdAt: document.createdAt.toISOString(),
    });
  } catch (error) {
    return jsonError(createApiError(error, "Unable to generate document."), 500);
  }
}
