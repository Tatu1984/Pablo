import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/backend/utils/jwt.util";

const PUBLIC_PREFIXES = ["/login", "/register", "/api/auth"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));

  // Logged-in users bounce off /login and /register to the app.
  if (session && (pathname === "/login" || pathname === "/register")) {
    const url = req.nextUrl.clone();
    url.pathname = "/agents";
    return NextResponse.redirect(url);
  }

  // Anonymous users trying to reach protected pages go to /login.
  if (!session && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// Don't run middleware on Next.js internals or static files.
export const config = {
  matcher: ["/((?!_next/|favicon\\.ico|images/|icons/).*)"],
};
