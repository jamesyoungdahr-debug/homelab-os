"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/swr/fetcher";
import { ServiceCard } from "./ServiceCard";
import type { ProwlarrSummary } from "@/lib/arr/types";

export function ProwlarrWidget() {
  const { data, isLoading } = useSWR<ProwlarrSummary>("/api/prowlarr/summary", fetcher, {
    refreshInterval: 15000,
  });

  if (isLoading || !data) {
    return (
      <ServiceCard title="Prowlarr" status="loading">
        <p className="text-sm text-neutral-500">Loading…</p>
      </ServiceCard>
    );
  }

  if (!data.online) {
    return (
      <ServiceCard title="Prowlarr" status="offline">
        <p className="text-sm text-red-400">Unreachable</p>
        {data.error && <p className="mt-1 text-xs text-neutral-500">{data.error}</p>}
      </ServiceCard>
    );
  }

  const failing = data.failingIndexers ?? [];

  return (
    <ServiceCard title="Prowlarr" status="online">
      <dl className="space-y-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-neutral-400">Version</dt>
          <dd>{data.version}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-neutral-400">Indexers</dt>
          <dd>
            {data.activeIndexerCount}/{data.indexerCount} active
          </dd>
        </div>
        {failing.length > 0 && (
          <div className="flex justify-between text-yellow-400">
            <dt>Failing</dt>
            <dd>{failing.length}</dd>
          </div>
        )}
      </dl>
    </ServiceCard>
  );
}
