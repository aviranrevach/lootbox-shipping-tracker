import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/api/auth/callback", "/api/auth/verify-password"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip password gate if no SITE_PASSWORD is configured (local dev)
  if (!process.env.SITE_PASSWORD) {
    return NextResponse.next();
  }

  // Allow public paths and static assets
  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  // Check for session cookie
  const session = request.cookies.get("site_session")?.value;
  if (session === process.env.SITE_PASSWORD) {
    return NextResponse.next();
  }

  // Redirect to login
  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
