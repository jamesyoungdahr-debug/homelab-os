import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sonarrEnv } from "@/lib/env";
import { getSonarrSummary } from "@/lib/arr/sonarr";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { url, apiKey } = sonarrEnv();
    const summary = await getSonarrSummary(url, apiKey);
    return NextResponse.json(summary);
  } catch (err) {
    // Missing/invalid env config — distinct from "service unreachable".
    return NextResponse.json(
      { online: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 200 },
    );
  }
}
