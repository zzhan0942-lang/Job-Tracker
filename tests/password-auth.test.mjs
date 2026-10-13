import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nativeRequire = createRequire(import.meta.url);
const modules = new Map();
function loadSource(filename) {
  if (modules.has(filename)) return modules.get(filename).exports;
  const loadedModule = { exports: {} };
  modules.set(filename, loadedModule);
  const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } });
  function requireSource(specifier) {
    if (specifier === "server-only") return {};
    if (specifier.startsWith("@/") || specifier.startsWith(".")) {
      const target = specifier.startsWith("@/") ? resolve(root, "src", specifier.slice(2)) : resolve(dirname(filename), specifier);
      if (existsSync(`${target}.ts`)) return loadSource(`${target}.ts`);
    }
    return nativeRequire(specifier);
  }
  new Function("require", "module", "exports", outputText)(requireSource, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}
const source = (path) => loadSource(resolve(root, "src", path));
const auth = source("lib/api-auth.ts");
const { proxy } = source("proxy.ts");
const { NextRequest } = nativeRequire("next/server");
const login = source("app/api/auth/login/route.ts").POST;
const logout = source("app/api/auth/logout/route.ts").POST;
const { loginRetryAfter } = source("lib/login-rate-limit.ts");
const password = "synthetic-密码: special & passphrase";
process.env.JOB_TRACKER_ACCESS_PASSWORD = password;
const token = await auth.createSession(password);
const cookie = `${auth.SESSION_COOKIE}=${token}`;
const origin = "https://job.example.test";
function request(path = "/", method = "GET", body, headers = {}, signed = false) {
  return new Request(origin + path, { method, headers: { ...(method === "GET" ? {} : { Origin: origin, "Content-Type": "application/json" }), ...(signed ? { Cookie: cookie } : {}), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}

test("session signatures: expiry, tampering, malformed tokens, password rotation and unicode", async () => {
  const now = Date.now();
  const first = await auth.createSession(password, now);
  assert.equal(await auth.verifySession(first, password, now), true);
  assert.notEqual(first, await auth.createSession(password, now));
  assert.equal(await auth.verifySession(first, password, now + auth.SESSION_SECONDS * 1000), false);
  assert.equal(await auth.verifySession(first, password, now - 1000), false);
  assert.equal(await auth.verifySession(first, "changed-password", now), false);
  for (const value of [undefined, "", first + ".", first.replace("v1", "v2"), first.slice(0, -1) + (first.endsWith("a") ? "b" : "a"), "x".repeat(1000)]) assert.equal(await auth.verifySession(value, password, now), false);
  assert.ok(!first.includes(password));
  assert.equal(await auth.passwordMatches(password, password), true);
  assert.equal(await auth.passwordMatches(password.trim() + "x", password), false);
});

test("login accepts only correct password; sets private signed HttpOnly seven-day cookie", async () => {
  const wrong = await login(request("/api/auth/login", "POST", { password: "wrong" }));
  assert.equal(wrong.status, 401);
  assert.equal(wrong.headers.has("www-authenticate"), false);
  assert.equal(wrong.headers.has("set-cookie"), false);
  const response = await login(request("/api/auth/login", "POST", { password }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true });
  const setCookie = response.headers.get("set-cookie");
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Lax/);
  assert.match(setCookie, /Max-Age=604800/);
  assert.match(setCookie, /Path=\//);
  assert.match(response.headers.get("cache-control"), /private.*no-store/);
  const issued = setCookie.split(";")[0].split("=")[1];
  assert.equal(await auth.verifySession(issued, password), true);
  assert.equal(await auth.requireApiAuth(request("/api/applications", "GET", undefined, { Cookie: setCookie.split(";")[0] })), null);
  assert.equal(await auth.requireApiAuth(request("/api/applications", "GET", undefined, { Cookie: setCookie.split(";")[0] })), null);
  const env = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "production";
    assert.match(auth.sessionCookie(token), /; Secure$/);
    process.env.NODE_ENV = "development";
    assert.ok(!auth.sessionCookie(token).includes("Secure"));
  } finally { if (env === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = env; }
});

test("proxy redirects anonymous pages and rejects APIs; only exact login routes bypass it", async () => {
  const page = await proxy(new NextRequest(request("/?page=2")));
  assert.equal(page.status, 307);
  assert.equal(new URL(page.headers.get("location")).pathname, "/login");
  assert.equal(new URL(page.headers.get("location")).searchParams.get("next"), "/?page=2");
  assert.equal((await proxy(new NextRequest(request("/application/example")))).status, 307);
  for (const path of ["/api/applications", "/api/progress", "/api/ai/parse-job-screenshot", "/api/debug/auth-env", "/api/debug/auth-request", "/api/auth/login/child"]) assert.equal((await proxy(new NextRequest(request(path)))).status, 401);
  assert.equal((await proxy(new NextRequest(request("/login")))).headers.get("x-middleware-next"), "1");
  assert.equal((await proxy(new NextRequest(request("/api/auth/login", "POST", {})))).headers.get("x-middleware-next"), "1");
  const signed = await proxy(new NextRequest(request("/", "GET", undefined, {}, true)));
  assert.equal(signed.headers.get("x-middleware-next"), "1");
  assert.match(signed.headers.get("cache-control"), /private.*no-store/);
});

test("same-origin guard rejects cross-site, sibling-site, missing/null origins and forwarded-host spoofing", async () => {
  for (const headers of [{ Origin: "https://evil.example" }, { Origin: "null" }, { Origin: "" }, { Origin: origin, "Sec-Fetch-Site": "cross-site" }, { Origin: origin, "Sec-Fetch-Site": "same-site" }, { Origin: "https://evil.example", "X-Forwarded-Host": "evil.example" }]) {
    assert.equal((await login(request("/api/auth/login", "POST", { password }, headers))).status, 403);
    assert.equal((await logout(request("/api/auth/logout", "POST", undefined, headers))).status, 403);
    assert.equal((await auth.requireApiAuth(request("/api/applications", "DELETE", {}, headers, true))).status, 403);
  }
  assert.equal(auth.requireSameOrigin(request("/api/auth/login", "POST", {}, { "Sec-Fetch-Site": "same-origin" })), null);
});

test("missing/blank password fails closed, runtime rotation invalidates cookie, duplicate cookies rejected", async () => {
  try {
    for (const configured of [undefined, "", " \t "]) {
      if (configured === undefined) delete process.env.JOB_TRACKER_ACCESS_PASSWORD;
      else process.env.JOB_TRACKER_ACCESS_PASSWORD = configured;
      assert.equal((await auth.requireApiAuth(request("/", "GET", undefined, {}, true))).status, 503);
      assert.equal((await login(request("/api/auth/login", "POST", { password }))).status, 503);
      assert.equal((await proxy(new NextRequest(request("/")))).status, 503);
    }
    process.env.JOB_TRACKER_ACCESS_PASSWORD = "rotated";
    assert.equal((await auth.requireApiAuth(request("/", "GET", undefined, {}, true))).status, 401);
  } finally { process.env.JOB_TRACKER_ACCESS_PASSWORD = password; }
  assert.equal((await auth.requireApiAuth(request("/api/applications", "GET", undefined, { Cookie: `${cookie}; ${cookie}` }))).status, 401);
});

test("logout expires cookie and next anonymous request is rejected", async () => {
  const response = await logout(request("/api/auth/logout", "POST", undefined, {}, true));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("set-cookie"), /Max-Age=0/);
  assert.equal((await auth.requireApiAuth(request("/api/applications", "GET", undefined, { Cookie: response.headers.get("set-cookie").split(";")[0] }))).status, 401);
});

test("login request validation and bounded body do not create a session", async () => {
  for (const body of [{}, [], { password: 123 }, { password, extra: true }]) {
    const response = await login(request("/api/auth/login", "POST", body));
    assert.equal(response.status, 400);
    assert.equal(response.headers.has("set-cookie"), false);
  }
  assert.equal((await login(request("/api/auth/login", "POST", { password: "x".repeat(9000) }))).status, 413);
});

// All Notion access is mocked: exercise CRUD and ownership without real records.
const appId = "00000000-0000-4000-8000-000000000001";
const progressId = "00000000-0000-4000-8000-000000000002";
const otherId = "00000000-0000-4000-8000-000000000003";
const appPage = { id: appId, properties: { 公司名称: { type: "rich_text", rich_text: [{ plain_text: "测试公司" }] }, 岗位名称: { type: "rich_text", rich_text: [{ plain_text: "测试岗位" }] } } };
const progressPage = { id: progressId, properties: { 事件类型: { select: { name: "收到一面" } } } };
const writes = [];
modules.set(resolve(root, "src/lib/notion-data.ts"), { exports: {
  applicationsDataSourceId: () => "applications", progressDataSourceId: () => "progress",
  getDataSourcePages: async (id) => [id === "applications" ? appPage : progressPage],
  findPageInDataSource: async (sourceId, id) => sourceId === "applications" && id === appId ? appPage : sourceId === "progress" && id === progressId ? progressPage : null,
  relatedApplicationIds: () => [appId], relatedProgressPages: async () => [progressPage],
  notion: { pages: { create: async (payload) => { writes.push(payload); return { id: progressId }; }, update: async (payload) => { writes.push(payload); } } },
} });
const applications = source("app/api/applications/route.ts");
const progress = source("app/api/progress/route.ts");
const ai = source("app/api/ai/parse-job-screenshot/route.ts");
const appInput = { company: "测试公司", role: "测试岗位", status: "已投递", base: "", date: "", note: "", url: "" };
const progressInput = { company: "测试公司", role: "测试岗位", applicationId: appId, event: "收到一面", stage: "面试", result: "流程中", date: "", nextDate: "", note: "", link: "" };

test("every business route independently requires session, including all CRUD methods and AI", async () => {
  for (const [path, route] of [["/api/applications", applications], ["/api/progress", progress], ["/api/ai/parse-job-screenshot", ai]]) {
    for (const method of ["GET", "POST", "PATCH", "DELETE"].filter((method) => route[method])) {
      const response = await route[method](request(path, method, method === "GET" ? undefined : {}));
      assert.equal(response.status, 401);
      assert.equal(response.headers.has("www-authenticate"), false);
    }
  }
  assert.equal(writes.length, 0);
});

test("authenticated Applications and Progress CRUD keep validation, ownership and status sync (mock Notion)", async () => {
  assert.equal((await applications.GET(request("/api/applications", "GET", undefined, {}, true))).status, 200);
  assert.equal((await progress.GET(request("/api/progress", "GET", undefined, {}, true))).status, 200);
  for (const [route, path, input] of [[applications, "/api/applications", appInput], [progress, "/api/progress", progressInput]]) {
    assert.equal((await route.POST(request(path, "POST", {}, {}, true))).status, 400);
    assert.equal((await route.POST(request(path, "POST", input, {}, true))).status, 200);
    const id = route === applications ? appId : progressId;
    assert.equal((await route.PATCH(request(path, "PATCH", { ...input, id }, {}, true))).status, 200);
    const before = writes.length;
    assert.equal((await route.PATCH(request(path, "PATCH", { ...input, id: otherId }, {}, true))).status, 404);
    assert.equal((await route.DELETE(request(path, "DELETE", { id: otherId }, {}, true))).status, 404);
    assert.equal(writes.length, before);
    assert.equal((await route.DELETE(request(path, "DELETE", { id }, {}, true))).status, 200);
  }
  const before = writes.length;
  assert.equal((await progress.PATCH(request("/api/progress", "PATCH", { ...progressInput, id: progressId, applicationId: otherId }, {}, true))).status, 400);
  assert.equal((await progress.POST(request("/api/progress", "POST", { ...progressInput, applicationId: otherId }, {}, true))).status, 404);
  assert.equal(writes.length, before);
  assert.ok(writes.some((payload) => payload.properties?.投递状态?.status?.name === "面试中"));
  assert.ok(writes.some((payload) => payload.in_trash === true));
});

test("login endpoint returns 429 and Retry-After; instance window resets without trusting IP headers", async () => {
  let response;
  for (let index = 0; index < 11; index++) response = await login(request("/api/auth/login", "POST", { password: "wrong" }, { "X-Forwarded-For": `192.0.2.${index}` }));
  assert.equal(response.status, 429);
  assert.ok(Number(response.headers.get("retry-after")) > 0);
  assert.equal(response.headers.has("set-cookie"), false);
  const future = Date.now() + 16 * 60 * 1000;
  for (let index = 0; index < 10; index++) assert.equal(loginRetryAfter(future), null);
  assert.equal(loginRetryAfter(future), 900);
  assert.equal(loginRetryAfter(future + 900001), null);
});

test("diagnostics files are gone and auth source has no Node-only dependencies", () => {
  for (const path of ["src/lib/auth-diagnostics.ts", "src/app/api/debug/auth-env/route.ts", "src/app/api/debug/auth-request/route.ts", "tests/auth-diagnostics.test.mjs"]) assert.equal(existsSync(resolve(root, path)), false);
  const source = readFileSync(resolve(root, "src/lib/api-auth.ts"), "utf8");
  assert.ok(!source.includes("node:crypto"));
  assert.ok(!source.includes("JOB_TRACKER_AUTH_"));
  assert.ok(!source.includes("NEXT_PUBLIC_"));
});

test("session cryptography works without Buffer or native Node crypto imports", async () => {
  const originalBuffer = globalThis.Buffer;
  try {
    globalThis.Buffer = undefined;
    const session = await auth.createSession(password);
    assert.equal(await auth.verifySession(session, password), true);
    assert.equal(await auth.passwordMatches(password, password), true);
  } finally { globalThis.Buffer = originalBuffer; }
});
