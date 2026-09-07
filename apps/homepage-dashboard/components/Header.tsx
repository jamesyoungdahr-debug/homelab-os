import { signOut } from "@/auth";

export function Header({ user }: { user?: { name?: string | null; email?: string | null } }) {
  return (
    <header className="mb-6 flex items-center justify-between">
      <h1 className="text-xl font-semibold">Homepage</h1>
      <div className="flex items-center gap-3 text-sm text-neutral-400">
        <span>{user?.name ?? user?.email}</span>
        <form
          action={async () => {
            "use server";
            await signOut();
          }}
        >
          <button type="submit" className="rounded border border-neutral-700 px-2 py-1 hover:bg-neutral-800">
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
