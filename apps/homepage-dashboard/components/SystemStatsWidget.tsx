"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/swr/fetcher";
import { ServiceCard } from "./ServiceCard";
import { ProgressBar, formatBytes } from "./ProgressBar";
import { NetworkSparkline } from "./NetworkSparkline";
import type { SystemStats } from "@/lib/system/stats";

const HISTORY_LENGTH = 30;

export function SystemStatsWidget() {
  const { data, isLoading } = useSWR<SystemStats>("/api/system", fetcher, { refreshInterval: 4000 });
  const [rxHistory, setRxHistory] = useState<number[]>([]);
  const [txHistory, setTxHistory] = useState<number[]>([]);
  const lastSeen = useRef<number | null>(null);

  useEffect(() => {
    if (!data || data.network.rxBytesPerSec === null) return;
    if (lastSeen.current === data.network.rxBytesPerSec) return; // dedupe if SWR re-fires with same data
    lastSeen.current = data.network.rxBytesPerSec;

    setRxHistory((h) => [...h, data.network.rxBytesPerSec ?? 0].slice(-HISTORY_LENGTH));
    setTxHistory((h) => [...h, data.network.txBytesPerSec ?? 0].slice(-HISTORY_LENGTH));
  }, [data]);

  if (isLoading || !data) {
    return (
      <ServiceCard title="System" status="loading">
        <p className="text-sm text-neutral-500">Loading…</p>
      </ServiceCard>
    );
  }

  return (
    <ServiceCard title="System" status="online">
      <ProgressBar label="CPU" percent={data.cpu.loadPercent} />
      <ProgressBar
        label="Memory"
        percent={data.memory.usedPercent}
        usedBytes={data.memory.usedBytes}
        totalBytes={data.memory.totalBytes}
      />
      <ProgressBar
        label={`Disk (${data.disk.mount})`}
        percent={data.disk.usedPercent}
        usedBytes={data.disk.usedBytes}
        totalBytes={data.disk.totalBytes}
      />

      <div className="mt-3">
        <div className="mb-1 flex justify-between text-xs text-neutral-400">
          <span>↓ Download ({data.network.interface})</span>
          <span>{data.network.rxBytesPerSec !== null ? `${formatBytes(data.network.rxBytesPerSec)}/s` : "—"}</span>
        </div>
        <NetworkSparkline history={rxHistory} />

        <div className="mb-1 mt-2 flex justify-between text-xs text-neutral-400">
          <span>↑ Upload</span>
          <span>{data.network.txBytesPerSec !== null ? `${formatBytes(data.network.txBytesPerSec)}/s` : "—"}</span>
        </div>
        <NetworkSparkline history={txHistory} />
      </div>
    </ServiceCard>
  );
}
