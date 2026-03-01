import { NextResponse } from "next/server";
import { createOAuth2Client, getAuthUrl } from "@/lib/gmail/client";

export async function GET() {
  const oauth2Client = createOAuth2Client();
  const url = getAuthUrl(oauth2Client);
  return NextResponse.redirect(url);
}
