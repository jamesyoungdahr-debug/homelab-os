import type { HealthIssue } from "./types";

// Shared authenticated fetch helper for Sonarr/Radarr/Prowlarr's REST APIs.
// Server-side only — the API key never reaches the browser, only the
// route handlers that call this do.

export async function arrFetch<T>(baseUrl: string, apiKey: string, path: string): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { "X-Api-Key": apiKey },
    cache: "no-store",
    // Don't let a dead/unreachable service hang a widget indefinitely.
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// Sonarr and Radarr expose the same v3 REST API shape for these endpoints —
// shared here so sonarr.ts/radarr.ts don't duplicate the same four calls.
export async function fetchArrV3Summary(baseUrl: string, apiKey: string) {
  const [status, queue, missing, health] = await Promise.all([
    arrFetch<{ version: string }>(baseUrl, apiKey, "/api/v3/system/status"),
    arrFetch<{ totalRecords: number }>(baseUrl, apiKey, "/api/v3/queue?pageSize=1"),
    arrFetch<{ totalRecords: number }>(baseUrl, apiKey, "/api/v3/wanted/missing?pageSize=1"),
    arrFetch<HealthIssue[]>(baseUrl, apiKey, "/api/v3/health"),
  ]);

  return {
    version: status.version,
    queueCount: queue.totalRecords,
    missingCount: missing.totalRecords,
    healthIssues: health,
  };
}
