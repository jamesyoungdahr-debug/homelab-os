import { arrFetch } from "./client";
import type { ProwlarrSummary } from "./types";

// Prowlarr is indexer-centric and uses /api/v1 (not v3 like Sonarr/Radarr) —
// field names below are written against current Prowlarr docs and are
// unverified against a live instance; double check against the real
// instance's Swagger UI (/docs) once deployed, per the plan's top risk list.
interface ProwlarrIndexer {
  name: string;
  enable: boolean;
}

interface ProwlarrHealthIssue {
  type: string;
  message: string;
  source?: string;
}

export async function getProwlarrSummary(baseUrl: string, apiKey: string): Promise<ProwlarrSummary> {
  try {
    const [status, indexers, health] = await Promise.all([
      arrFetch<{ version: string }>(baseUrl, apiKey, "/api/v1/system/status"),
      arrFetch<ProwlarrIndexer[]>(baseUrl, apiKey, "/api/v1/indexer"),
      arrFetch<ProwlarrHealthIssue[]>(baseUrl, apiKey, "/api/v1/health"),
    ]);

    return {
      online: true,
      version: status.version,
      indexerCount: indexers.length,
      activeIndexerCount: indexers.filter((i) => i.enable).length,
      failingIndexers: health.map((h) => ({ name: h.source ?? "unknown", message: h.message })),
    };
  } catch (err) {
    return { online: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
