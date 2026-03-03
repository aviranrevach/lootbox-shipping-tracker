import { NextRequest, NextResponse } from "next/server";
import { createOAuth2Client } from "@/lib/gmail/client";
import { storeAccountTokens } from "@/lib/gmail/auth";
import { getGmailProfile } from "@/lib/gmail/fetch";

function getBaseUrl(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const proto = request.headers.get("x-forwarded-proto") || "https";
  if (forwardedHost) {
    return `${proto}://${forwardedHost}`;
  }
  return request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const baseUrl = getBaseUrl(request);

  if (!code) {
    return NextResponse.redirect(new URL("/settings?error=no_code", baseUrl));
  }

  try {
    const oauth2Client = createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    // Discover which email was authorized
    oauth2Client.setCredentials(tokens);
    const profile = await getGmailProfile(oauth2Client);
    const email = profile.emailAddress;

    if (!email) {
      return NextResponse.redirect(new URL("/settings?error=no_email", baseUrl));
    }

    await storeAccountTokens(email, tokens);

    return NextResponse.redirect(
      new URL(
        `/settings?connected=true&email=${encodeURIComponent(email)}`,
        baseUrl
      )
    );
  } catch (error) {
    console.error("OAuth callback error:", error);
    return NextResponse.redirect(new URL("/settings?error=auth_failed", baseUrl));
  }
}
