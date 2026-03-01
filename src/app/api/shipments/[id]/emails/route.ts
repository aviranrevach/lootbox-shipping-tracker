import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { emailSync } from "@/lib/db/schema";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const shipmentId = parseInt(id);

    const emails = await db
      .select({
        gmailMessageId: emailSync.gmailMessageId,
        subject: emailSync.subject,
        fromAddress: emailSync.fromAddress,
        receivedAt: emailSync.receivedAt,
        parserUsed: emailSync.parserUsed,
      })
      .from(emailSync)
      .where(
        and(
          eq(emailSync.shipmentId, shipmentId),
          eq(emailSync.resultStatus, "matched")
        )
      )
      .orderBy(desc(emailSync.receivedAt));

    return NextResponse.json(emails);
  } catch (error) {
    console.error("Shipment emails error:", error);
    return NextResponse.json(
      { error: "Failed to fetch emails" },
      { status: 500 }
    );
  }
}
