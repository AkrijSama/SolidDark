function getFeedEndpoint(): string {
  return process.env.SOLIDDARK_FEED_URL || "https://soliddark.com/api/intelligence/feed";
}

interface CommunityDomain {
  domain: string;
  confidence: number;
  category: string;
  totalBlocks: number;
}

export async function fetchCommunityFeed(
  addToDenyList: (domain: string, reason: string) => Promise<void>,
): Promise<number> {
  try {
    const response = await fetch(getFeedEndpoint(), {
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      console.warn(`[Community Feed] Fetch failed: ${response.status} ${response.statusText}`);
      return 0;
    }

    const data = (await response.json()) as { domains?: CommunityDomain[] };
    const domains = data.domains ?? [];

    let added = 0;
    for (const domain of domains) {
      if (domain.confidence >= 0.7) {
        await addToDenyList(
          domain.domain,
          `Community: ${domain.totalBlocks} blocks, ${(domain.confidence * 100).toFixed(0)}% confidence`,
        );
        added += 1;
      }
    }

    return added;
  } catch (error) {
    console.warn("[Community Feed] Fetch failed.", error instanceof Error ? error.message : error);
    return 0;
  }
}
