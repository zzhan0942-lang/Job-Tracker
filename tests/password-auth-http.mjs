// Run against an isolated localhost production build with a synthetic password.
// Never contacts a real provider or prints cookies/passwords/response bodies.
import assert from "node:assert/strict";
const origin = process.env.AUTH_TEST_ORIGIN ?? "http://localhost:3013";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname));
const syntheticPassword = "local-only-synthetic-passphrase";
async function call(path, method = "GET", body, cookie, headers = {}) {
  return fetch(origin + path, { method, redirect: "manual", headers: { ...(method === "GET" ? {} : { Origin: origin, "Content-Type": "application/json" }), ...(cookie ? { Cookie: cookie } : {}), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
const home = await call("/");
assert.equal(home.status, 307);
assert.equal(new URL(home.headers.get("location"), origin).pathname, "/login");
assert.equal((await call("/login")).status, 200);
for (const path of ["/api/applications", "/api/progress", "/api/ai/parse-job-screenshot"]) assert.equal((await call(path, path.includes("/ai/") ? "POST" : "GET", path.includes("/ai/") ? {} : undefined)).status, 401);
assert.equal((await call("/api/auth/login", "POST", { password: "wrong" })).status, 401);
assert.equal((await call("/api/auth/login", "POST", { password: syntheticPassword }, undefined, { Origin: "https://cross-site.example" })).status, 403);
const login = await call("/api/auth/login", "POST", { password: syntheticPassword });
assert.equal(login.status, 200);
const setCookie = login.headers.get("set-cookie");
for (const flag of ["HttpOnly", "SameSite=Lax", "Secure", "Max-Age=604800"]) assert.ok(setCookie.includes(flag));
const cookie = setCookie.split(";")[0];
for (let index = 0; index < 2; index++) {
  const signedHome = await call("/", "GET", undefined, cookie);
  assert.equal(signedHome.status, 200);
  assert.match(signedHome.headers.get("cache-control"), /private.*no-store/);
}
// No real Notion credentials in this build: 503 means auth passed, not live integration success.
for (const path of ["/api/applications", "/api/progress"]) assert.equal((await call(path, "GET", undefined, cookie)).status, 503);
assert.equal((await call("/api/ai/parse-job-screenshot", "POST", {}, cookie)).status, 415);
assert.equal((await call("/api/applications", "POST", {}, cookie)).status, 400);
assert.equal((await call("/api/applications", "POST", {}, cookie, { Origin: "https://cross-site.example" })).status, 403);
for (const path of ["/api/debug/auth-env", "/api/debug/auth-request"]) assert.equal((await call(path, "GET", undefined, cookie)).status, 404);
const logout = await call("/api/auth/logout", "POST", undefined, cookie);
assert.equal(logout.status, 200);
assert.ok(logout.headers.get("set-cookie").includes("Max-Age=0"));
assert.equal((await call("/")).status, 307);
assert.equal((await call("/api/applications")).status, 401);
let blocked;
for (let index = 0; index < 11; index++) blocked = await call("/api/auth/login", "POST", { password: "wrong" });
assert.equal(blocked.status, 429);
assert.ok(Number(blocked.headers.get("retry-after")) > 0);
console.log("Local production HTTP checks passed: redirects, login, refresh, API guards, CSRF, logout, rate limit, deleted debug routes. Provider CRUD/AI covered by mocked unit tests.");
