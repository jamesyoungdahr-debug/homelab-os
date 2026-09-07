import { fetchArrV3Summary } from "./client";
import type { SonarrSummary } from "./types";

export async function getSonarrSummary(baseUrl: string, apiKey: string): Promise<SonarrSummary> {
  try {
    const summary = await fetchArrV3Summary(baseUrl, apiKey);
    return { online: true, ...summary };
  } catch (err) {
    return { online: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
