import { accessPassword, authResponse, createSession, passwordMatches, privateHeaders, requireSameOrigin, sessionCookie } from "@/lib/api-auth";
import { loginRetryAfter } from "@/lib/login-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  const password = accessPassword();
  if (!password) return authResponse("访问密码未配置，服务暂不可用", 503);
  const retryAfter = loginRetryAfter();
  if (retryAfter) return authResponse("尝试过于频繁，请稍后重试", 429, { "Retry-After": String(retryAfter) });
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return authResponse("请求格式不正确", 400);
  const reader = request.body?.getReader();
  if (!reader) return authResponse("请求格式不正确", 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) { await reader.cancel(); return authResponse("请求过大", 413); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const input = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!input || typeof input !== "object" || Array.isArray(input) || typeof input.password !== "string" || !input.password || input.password.length > 1024 || Object.keys(input).some((key) => key !== "password")) return authResponse("请求格式不正确", 400);
    if (!await passwordMatches(input.password, password)) return authResponse("访问密码不正确", 401);
    return Response.json({ success: true }, { headers: { ...privateHeaders, "Set-Cookie": sessionCookie(await createSession(password)) } });
  } catch { return authResponse("请求格式不正确", 400); }
  finally { reader.releaseLock(); }
}
