import { NextRequest, NextResponse } from "next/server";

// Allow requests from the Chrome extension (chrome-extension://<id>) and
// from the deployed web app itself. Chrome extension origins are unique per
// install, so we can't allowlist a single origin string — instead we allow
// any chrome-extension:// origin, matching on the incoming Origin header.
function buildCorsHeaders(origin: string | null) {
  const headers = new Headers();

  const isExtension = origin?.startsWith("chrome-extension://");
  const allowedOrigin = isExtension ? origin! : origin ?? "*";

  headers.set("Access-Control-Allow-Origin", allowedOrigin);
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  headers.set("Vary", "Origin");

  return headers;
}

export function middleware(request: NextRequest) {
  const origin = request.headers.get("origin");
  const corsHeaders = buildCorsHeaders(origin);

  // Preflight
  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: corsHeaders });
  }

  const response = NextResponse.next();
  corsHeaders.forEach((value, key) => response.headers.set(key, value));
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
