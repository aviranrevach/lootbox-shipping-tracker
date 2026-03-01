import { NextRequest, NextResponse } from "next/server";
import { removeAccount } from "@/lib/gmail/auth";

export async function DELETE(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email");

  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  try {
    await removeAccount(email);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Remove account error:", error);
    return NextResponse.json(
      { error: "Failed to remove account" },
      { status: 500 }
    );
  }
}
