import { NextResponse, type NextRequest } from "next/server";
import { privateHeaders, requireApiAuth } from "./lib/api-auth";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  // Only the login page and exact POST auth routes are public. No debug exemption.
  if (path === "/login" || (request.method === "POST" && ["/api/auth/login", "/api/auth/logout"].includes(path))) {
    const response = NextResponse.next();
    for (const [name, value] of Object.entries(privateHeaders)) response.headers.set(name, value);
    return response;
  }
  const error = await requireApiAuth(request);
  if (error) {
    if (path === "/api" || path.startsWith("/api/") || error.status !== 401) return error;
    const url = new URL("/login", request.url);
    url.searchParams.set("next", path + request.nextUrl.search);
    return NextResponse.redirect(url, { headers: privateHeaders });
  }
  const response = NextResponse.next();
  for (const [name, value] of Object.entries(privateHeaders)) response.headers.set(name, value);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
