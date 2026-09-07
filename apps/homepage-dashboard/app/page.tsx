import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Header } from "@/components/Header";
import { SonarrWidget } from "@/components/SonarrWidget";
import { RadarrWidget } from "@/components/RadarrWidget";
import { ProwlarrWidget } from "@/components/ProwlarrWidget";
import { SystemStatsWidget } from "@/components/SystemStatsWidget";

export default async function DashboardPage() {
  const session = await auth();
  // The proxy's `authorized` callback already redirects unauthenticated
  // requests, but per Next.js's own auth guidance that's only an optimistic
  // check — verify again here, close to the actual page content.
  if (!session) {
    redirect("/api/auth/signin");
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <Header user={session?.user} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SonarrWidget />
        <RadarrWidget />
        <ProwlarrWidget />
        <SystemStatsWidget />
      </div>
    </main>
  );
}
