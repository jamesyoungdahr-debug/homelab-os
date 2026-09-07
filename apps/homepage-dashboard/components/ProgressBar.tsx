function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export function ProgressBar({
  label,
  usedBytes,
  totalBytes,
  percent,
}: {
  label: string;
  usedBytes?: number;
  totalBytes?: number;
  percent: number;
}) {
  const color = percent > 90 ? "bg-red-500" : percent > 75 ? "bg-yellow-500" : "bg-blue-500";

  return (
    <div className="mb-2">
      <div className="mb-1 flex justify-between text-xs text-neutral-400">
        <span>{label}</span>
        <span>
          {usedBytes !== undefined && totalBytes !== undefined
            ? `${formatBytes(usedBytes)} / ${formatBytes(totalBytes)}`
            : `${percent.toFixed(0)}%`}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-neutral-800">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
    </div>
  );
}

export { formatBytes };
