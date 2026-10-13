import { privateHeaders, requireSameOrigin, sessionCookie } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const error = requireSameOrigin(request);
  if (error) return error;
  return Response.json({ success: true }, { headers: { ...privateHeaders, "Set-Cookie": sessionCookie("", 0) } });
}
