"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/swr/fetcher";
import { ServiceCard } from "./ServiceCard";
import type { SonarrSummary, RadarrSummary } from "@/lib/arr/types";

// Sonarr and Radarr summaries share the same shape — this is the shared
// rendering logic behind both SonarrWidget and RadarrWidget.
export function ArrQueueWidget({ title, endpoint }: { title: string; endpoint: string }) {
  const { data, isLoading } = useSWR<SonarrSummary | RadarrSummary>(endpoint, fetcher, {
    refreshInterval: 15000,
  });

  if (isLoading || !data) {
    return (
      <ServiceCard title={title} status="loading">
        <p className="text-sm text-neutral-500">Loading…</p>
      </ServiceCard>
    );
  }

  if (!data.online) {
    return (
      <ServiceCard title={title} status="offline">
        <p className="text-sm text-red-400">Unreachable</p>
        {data.error && <p className="mt-1 text-xs text-neutral-500">{data.error}</p>}
      </ServiceCard>
    );
  }

  const hasHealthIssues = (data.healthIssues?.length ?? 0) > 0;

  return (
    <ServiceCard title={title} status="online">
      <dl className="space-y-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-neutral-400">Version</dt>
          <dd>{data.version}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-neutral-400">Queue</dt>
          <dd>{data.queueCount}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-neutral-400">Missing</dt>
          <dd>{data.missingCount}</dd>
        </div>
        {hasHealthIssues && (
          <div className="flex justify-between text-yellow-400">
            <dt>Health issues</dt>
            <dd>{data.healthIssues!.length}</dd>
          </div>
        )}
      </dl>
    </ServiceCard>
  );
}
