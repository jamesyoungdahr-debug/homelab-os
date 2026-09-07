import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { radarrEnv } from "@/lib/env";
import { getRadarrSummary } from "@/lib/arr/radarr";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { url, apiKey } = radarrEnv();
    const summary = await getRadarrSummary(url, apiKey);
    return NextResponse.json(summary);
  } catch (err) {
    return NextResponse.json(
      { online: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 200 },
    );
  }
}
