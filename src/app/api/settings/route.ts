import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";

export async function GET() {
  try {
    const rows = await db.select().from(settings);
    const result: Record<string, string> = {};

    for (const row of rows) {
      // Don't expose OAuth tokens in settings response
      if (row.key === "gmail_tokens") continue;
      result[row.key] = row.value;
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Settings GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    for (const [key, value] of Object.entries(body)) {
      // Don't allow modifying tokens via this route
      if (key === "gmail_tokens") continue;

      const existing = await db
        .select()
        .from(settings)
        .where(eq(settings.key, key))
        .get();

      if (existing) {
        await db
          .update(settings)
          .set({ value: String(value), updatedAt: new Date().toISOString() })
          .where(eq(settings.key, key));
      } else {
        await db
          .insert(settings)
          .values({ key, value: String(value) });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Settings PUT error:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
