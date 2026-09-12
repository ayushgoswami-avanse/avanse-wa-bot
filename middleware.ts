import { NextRequest, NextResponse } from "next/server";

// Fast, edge-runtime cookie-presence check. Full JWT verification happens per-request in
// each protected layout (see app/admin/layout.tsx, app/agent/layout.tsx) since jsonwebtoken
// needs the Node runtime, not the edge runtime middleware runs under.
export function middleware(req: NextRequest) {
  const hasSession = req.cookies.has("sec_session");
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/agent/:path*"],
};
