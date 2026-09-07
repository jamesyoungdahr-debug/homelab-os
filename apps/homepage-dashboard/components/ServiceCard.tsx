type Status = "online" | "offline" | "loading";

const dotColor: Record<Status, string> = {
  online: "bg-green-500",
  offline: "bg-red-500",
  loading: "bg-neutral-500",
};

export function ServiceCard({
  title,
  status,
  children,
}: {
  title: string;
  status: Status;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${dotColor[status]}`} />
        <h2 className="font-medium text-neutral-100">{title}</h2>
      </div>
      {children}
    </div>
  );
}
