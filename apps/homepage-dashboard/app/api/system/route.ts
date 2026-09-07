import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSystemStats } from "@/lib/system/stats";

export const dynamic = "force-dynamic";
// systeminformation uses fs/child_process — incompatible with the Edge runtime.
export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stats = await getSystemStats();
  return NextResponse.json(stats);
}
