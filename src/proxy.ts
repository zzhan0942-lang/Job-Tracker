import { NextResponse, type NextRequest } from "next/server";
import { requireApiAuth } from "./lib/api-auth";

// This gives the browser a native Basic Auth prompt before rendering the UI.
// Route handlers repeat the check because Proxy is not an authorization boundary.
export function proxy(request: NextRequest) {
  return requireApiAuth(request) ?? NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
