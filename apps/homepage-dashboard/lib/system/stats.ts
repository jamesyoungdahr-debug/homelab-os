import si from "systeminformation";
import { diskMountPath } from "@/lib/env";

// networkStats() is delta-based between calls, so its very first invocation
// after process start returns null rate fields. Fire it once at module load
// to "prime" it — by the time a real request comes in on the long-running
// Node/Docker process, a valid delta already exists.
void si.networkStats();

export interface SystemStats {
  cpu: { loadPercent: number };
  memory: { usedBytes: number; totalBytes: number; usedPercent: number };
  disk: { mount: string; usedBytes: number; totalBytes: number; usedPercent: number };
  network: { rxBytesPerSec: number | null; txBytesPerSec: number | null; interface: string };
}

export async function getSystemStats(): Promise<SystemStats> {
  const mount = diskMountPath();

  const [load, mem, fsSize, netStats] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    si.fsSize(),
    si.networkStats(),
  ]);

  const disk = fsSize.find((d) => d.mount === mount) ?? fsSize[0];
  const net = netStats[0];

  return {
    cpu: { loadPercent: load.currentLoad },
    memory: {
      usedBytes: mem.active,
      totalBytes: mem.total,
      usedPercent: (mem.active / mem.total) * 100,
    },
    disk: {
      mount: disk?.mount ?? mount,
      usedBytes: disk?.used ?? 0,
      totalBytes: disk?.size ?? 0,
      usedPercent: disk?.use ?? 0,
    },
    network: {
      rxBytesPerSec: net?.rx_sec ?? null,
      txBytesPerSec: net?.tx_sec ?? null,
      interface: net?.iface ?? "unknown",
    },
  };
}
