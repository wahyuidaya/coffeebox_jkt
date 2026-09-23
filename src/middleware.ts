import { NextRequest, NextResponse } from "next/server";
import { decrypt, COOKIE_NAME } from "@/lib/session";

const ADMIN_PUBLIC_PATHS = ["/admin/login", "/admin/forgot-password", "/admin/reset-password"];
const KASIR_PUBLIC_PATHS = ["/kasir/login"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isAdminRoute = pathname.startsWith("/admin") && !ADMIN_PUBLIC_PATHS.includes(pathname);
  const isKasirRoute = pathname.startsWith("/kasir") && !KASIR_PUBLIC_PATHS.includes(pathname);

  if (!isAdminRoute && !isKasirRoute) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = await decrypt(token);

  if (!session) {
    return NextResponse.redirect(new URL(isAdminRoute ? "/admin/login" : "/kasir/login", req.url));
  }
  if (isAdminRoute && session.peran !== "admin") {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }
  if (isKasirRoute && session.peran !== "kasir") {
    return NextResponse.redirect(new URL("/kasir/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/kasir/:path*"],
};