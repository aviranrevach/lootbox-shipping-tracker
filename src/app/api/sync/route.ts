import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { syncLog } from "@/lib/db/schema";
import { syncEmails } from "@/lib/sync/engine";
import { isGmailConnected } from "@/lib/gmail/auth";

export async function POST() {
  try {
    const connected = await isGmailConnected();
    if (!connected) {
      return NextResponse.json(
        { error: "No Gmail accounts connected" },
        { status: 400 }
      );
    }

    const result = await syncEmails();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const latest = await db
      .select()
      .from(syncLog)
      .orderBy(desc(syncLog.startedAt))
      .limit(1)
      .get();

    return NextResponse.json(latest || null);
  } catch (error) {
    console.error("Sync status error:", error);
    return NextResponse.json(
      { error: "Failed to get sync status" },
      { status: 500 }
    );
  }
}
