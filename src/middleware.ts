import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "autofill_session";
const encoder = new TextEncoder();

function getSecret() {
  const secret = process.env.AUTH_SECRET || "dev-only-insecure-secret-change-me-please";
  return encoder.encode(secret);
}

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const { pathname } = request.nextUrl;

  let isAuthed = false;
  if (token) {
    try {
      await jwtVerify(token, getSecret());
      isAuthed = true;
    } catch {
      isAuthed = false;
    }
  }

  if (pathname.startsWith("/dashboard") && !isAuthed) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if ((pathname === "/login" || pathname === "/signup") && isAuthed) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/signup"],
};
