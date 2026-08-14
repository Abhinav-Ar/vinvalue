import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth(() => NextResponse.next());

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
