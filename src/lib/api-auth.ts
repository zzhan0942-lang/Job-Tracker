import "server-only";

// Shared by Proxy and route handlers. Web Crypto works in
// both Node and edge runtimes; no Buffer, native crypto or browser auth headers.
export const SESSION_COOKIE = "job_tracker_session";
export const SESSION_SECONDS = 7 * 24 * 60 * 60;
const encoder = new TextEncoder();

export function accessPassword() {
  const password = process.env.JOB_TRACKER_ACCESS_PASSWORD;
  return password && password.trim() ? password : null;
}

function hex(bytes: ArrayBuffer | Uint8Array) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function signingKey(password: string) {
  const key = await crypto.subtle.digest("SHA-256", encoder.encode(`job-tracker/session/v1\0${password}`));
  return crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function passwordMatches(candidate: string, password: string) {
  const [left, right] = await Promise.all([candidate, password].map((value) => crypto.subtle.digest("SHA-256", encoder.encode(value))));
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  let difference = 0;
  for (let index = 0; index < a.length; index++) difference |= a[index] ^ b[index];
  return difference === 0;
}

export async function createSession(password: string, now = Date.now()) {
  const issued = Math.floor(now / 1000);
  const nonce = hex(crypto.getRandomValues(new Uint8Array(16)));
  const payload = `v1.${issued}.${issued + SESSION_SECONDS}.${nonce}`;
  const signature = await crypto.subtle.sign("HMAC", await signingKey(password), encoder.encode(payload));
  return `${payload}.${hex(signature)}`;
}

export async function verifySession(token: string | undefined, password: string, now = Date.now()) {
  if (!token || token.length > 200) return false;
  const match = /^(v1)\.(\d{1,12})\.(\d{1,12})\.([a-f0-9]{32})\.([a-f0-9]{64})$/.exec(token);
  if (!match) return false;
  const issued = Number(match[2]);
  const expires = Number(match[3]);
  const seconds = Math.floor(now / 1000);
  if (issued > seconds || expires <= seconds || expires - issued !== SESSION_SECONDS) return false;
  try {
    const signature = Uint8Array.from(match[5].match(/../g)!, (byte) => parseInt(byte, 16));
    return await crypto.subtle.verify("HMAC", await signingKey(password), signature, encoder.encode(token.slice(0, token.lastIndexOf("."))));
  } catch { return false; }
}

export function sessionFromRequest(request: Request) {
  const matches = (request.headers.get("cookie") ?? "").split(";").map((part) => part.trim())
    .filter((part) => part.startsWith(`${SESSION_COOKIE}=`));
  // Reject ambiguous cookies rather than choosing an attacker-controlled path cookie.
  return matches.length === 1 ? matches[0].slice(SESSION_COOKIE.length + 1) : undefined;
}

export const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "CDN-Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

export function authResponse(error: string, status: number, headers: Record<string, string> = {}) {
  return Response.json({ success: false, error }, { status, headers: { ...privateHeaders, ...headers } });
}

export function requireSameOrigin(request: Request): Response | null {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return authResponse("不允许跨站请求", 403);
  try {
    const origin = request.headers.get("origin");
    if (!origin || new URL(origin).origin !== origin || origin !== new URL(request.url).origin) return authResponse("不允许跨站请求", 403);
  } catch { return authResponse("不允许跨站请求", 403); }
  return null;
}

export async function requireApiAuth(request: Request): Promise<Response | null> {
  const password = accessPassword();
  if (!password) return authResponse("访问密码未配置，服务暂不可用", 503);
  if (!await verifySession(sessionFromRequest(request), password)) return authResponse("请先登录", 401);
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) return requireSameOrigin(request);
  return null;
}

export function sessionCookie(token: string, maxAge = SESSION_SECONDS) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}
