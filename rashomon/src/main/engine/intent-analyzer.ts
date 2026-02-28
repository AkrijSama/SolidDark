import type { IntentProvider, IntentResult, RequestManifest } from "../../shared/types";

export interface IntentAnalyzerConfig {
  provider: IntentProvider;
  anthropicApiKey?: string;
  ollamaBaseUrl?: string;
  model?: string;
  maxTokens?: number;
  threshold?: number;
}

export interface IntentAnalyzer {
  analyzeIntent: (manifest: RequestManifest) => Promise<IntentResult>;
  isEnabled: () => boolean;
  updateConfig: (nextConfig: Partial<IntentAnalyzerConfig>) => void;
  getConfig: () => IntentAnalyzerConfig;
}

const defaultConfig: IntentAnalyzerConfig = {
  provider: (process.env.ANTHROPIC_API_KEY
    ? "anthropic"
    : process.env.OLLAMA_BASE_URL
      ? "ollama"
      : "disabled") as IntentProvider,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434",
  model: process.env.INTENT_MODEL ?? "claude-sonnet-4-5-20250929",
  maxTokens: 250,
  threshold: 30,
};

function buildPrompt(manifest: RequestManifest): string {
  return [
    "You are Rashomon, a security gate reviewing an AI agent's outbound request.",
    "Given the manifest below, determine whether the request is consistent with the agent's declared purpose.",
    "Return JSON with keys mismatchScore (0-100) and reasoning (one sentence).",
    "",
    JSON.stringify(
      {
        who: manifest.who,
        what: {
          ...manifest.what,
          bodyPreview: manifest.what.bodyPreview,
        },
        where: manifest.where,
        why: {
          secretsDetected: manifest.why.secretsDetected.map((match) => ({
            type: match.type,
            detector: match.detector,
            location: match.location,
            confidence: match.confidence,
          })),
          policyViolations: manifest.why.policyViolations,
          anomalies: manifest.why.anomalies,
        },
        risk: manifest.risk,
      },
      null,
      2,
    ),
  ].join("\n");
}

function parseIntentResponse(raw: string, provider: IntentProvider, model: string): IntentResult {
  try {
    const parsed = JSON.parse(raw) as { mismatchScore?: number; reasoning?: string };
    return {
      provider,
      model,
      mismatchScore: Math.max(0, Math.min(100, parsed.mismatchScore ?? 50)),
      reasoning: parsed.reasoning ?? "Model returned no reasoning.",
      analyzedAt: Date.now(),
    };
  } catch {
    const mismatchMatch = raw.match(/(\d{1,3})/);
    return {
      provider,
      model,
      mismatchScore: Math.max(0, Math.min(100, Number(mismatchMatch?.[1] ?? 50))),
      reasoning: raw.trim().slice(0, 240) || "Model returned an unparsable response.",
      analyzedAt: Date.now(),
    };
  }
}

export function createIntentAnalyzer(initialConfig: Partial<IntentAnalyzerConfig> = {}): IntentAnalyzer {
  let config: IntentAnalyzerConfig = {
    ...defaultConfig,
    ...initialConfig,
  };

  const recentCalls: number[] = [];

  function isEnabled(): boolean {
    return config.provider !== "disabled";
  }

  function enforceRateLimit(): void {
    const now = Date.now();
    while (recentCalls.length > 0 && now - recentCalls[0] > 60_000) {
      recentCalls.shift();
    }

    if (recentCalls.length >= 10) {
      throw new Error("Intent analysis rate limit exceeded.");
    }

    recentCalls.push(now);
  }

  async function analyzeWithAnthropic(prompt: string): Promise<string> {
    if (!config.anthropicApiKey) {
      throw new Error("ANTHROPIC_API_KEY is not configured.");
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": config.anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: config.maxTokens,
        system: "You are a security analyst. Respond with JSON only.",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic intent analysis failed with status ${response.status}.`);
    }

    const payload = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };

    return payload.content?.find((item) => item.type === "text")?.text ?? "{}";
  }

  async function analyzeWithOllama(prompt: string): Promise<string> {
    const response = await fetch(`${config.ollamaBaseUrl}/api/generate`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: config.model ?? "llama3.1:8b",
        prompt,
        stream: false,
        options: {
          num_predict: config.maxTokens ?? 250,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama intent analysis failed with status ${response.status}.`);
    }

    const payload = (await response.json()) as { response?: string };
    return payload.response ?? "{}";
  }

  return {
    async analyzeIntent(manifest) {
      if (!isEnabled()) {
        return {
          provider: "disabled",
          model: "none",
          mismatchScore: 0,
          reasoning: "Intent analysis is disabled.",
          analyzedAt: Date.now(),
        };
      }

      enforceRateLimit();
      const prompt = buildPrompt(manifest);

      if (config.provider === "anthropic") {
        return parseIntentResponse(await analyzeWithAnthropic(prompt), "anthropic", config.model ?? "unknown");
      }

      return parseIntentResponse(await analyzeWithOllama(prompt), "ollama", config.model ?? "unknown");
    },

    isEnabled,

    updateConfig(nextConfig) {
      config = {
        ...config,
        ...nextConfig,
      };
    },

    getConfig() {
      return { ...config };
    },
  };
}

export const intentAnalyzer = createIntentAnalyzer();
export const analyzeIntent = intentAnalyzer.analyzeIntent;
export const isEnabled = intentAnalyzer.isEnabled;
