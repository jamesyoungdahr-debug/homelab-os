import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prowlarrEnv } from "@/lib/env";
import { getProwlarrSummary } from "@/lib/arr/prowlarr";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { url, apiKey } = prowlarrEnv();
    const summary = await getProwlarrSummary(url, apiKey);
    return NextResponse.json(summary);
  } catch (err) {
    return NextResponse.json(
      { online: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 200 },
    );
  }
}
