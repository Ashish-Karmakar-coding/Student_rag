/**
 * apps/frontend/middleware.ts
 *
 * Next.js edge middleware — protects all app routes.
 * Redirects unauthenticated users to the landing page (/).
 * Public routes: /, /api/auth/*, /api/sync-user
 */

import { auth } from "./auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default auth((req: NextRequest & { auth: unknown }) => {
  const { pathname } = req.nextUrl;

  // Public paths — no auth required
  const publicPaths = ["/", "/api/auth", "/api/sync-user"];
  const isPublic = publicPaths.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  if (isPublic) return NextResponse.next();

  // Check auth
  const session = (req as { auth?: { user?: { githubId?: string } } }).auth;
  if (!session?.user?.githubId) {
    const loginUrl = new URL("/", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/upload/:path*",
    "/chat/:path*",
    "/dashboard/:path*",
    "/quiz/:path*",
    "/settings/:path*",
  ],
};
