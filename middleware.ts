import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;

  // Redirect unauthenticated users away from protected pages
  if ((pathname === "/history" || pathname === "/garage") && !isLoggedIn) {
    const url = req.nextUrl.clone();
    url.pathname = "/appraise";
    url.searchParams.set("signin", "1");
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
