import { fetchArrV3Summary } from "./client";
import type { RadarrSummary } from "./types";

export async function getRadarrSummary(baseUrl: string, apiKey: string): Promise<RadarrSummary> {
  try {
    const summary = await fetchArrV3Summary(baseUrl, apiKey);
    return { online: true, ...summary };
  } catch (err) {
    return { online: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
