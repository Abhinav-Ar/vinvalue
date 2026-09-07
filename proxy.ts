import { NextResponse } from "next/server";
import { authController } from "@/controllers/authController";

export default authController.auth(() => NextResponse.next());

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
