import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, verifyToken } from "./lib/session";

export async function proxy(req: NextRequest) {
  const user = await verifyToken(req.cookies.get(COOKIE)?.value);
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|_next/|favicon.ico|icon.svg).*)"],
};
