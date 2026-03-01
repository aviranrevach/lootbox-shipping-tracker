import { NextResponse } from "next/server";
import { getConnectedAccounts } from "@/lib/gmail/auth";

export async function GET() {
  try {
    const accounts = await getConnectedAccounts();
    return NextResponse.json({
      connected: accounts.length > 0,
      accounts: accounts.map((a) => ({
        email: a.email,
        addedAt: a.addedAt,
      })),
    });
  } catch (error) {
    console.error("Auth status error:", error);
    return NextResponse.json({ connected: false, accounts: [] });
  }
}
