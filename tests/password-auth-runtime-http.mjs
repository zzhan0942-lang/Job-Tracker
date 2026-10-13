// Isolated localhost processes only: 3013 original, 3014 rotated, 3015 unset.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const loaded = { exports: {} };
const { outputText } = ts.transpileModule(readFileSync(new URL("../src/lib/api-auth.ts", import.meta.url), "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } });
new Function("require", "module", "exports", outputText)(() => ({}), loaded, loaded.exports);
const { createSession, SESSION_COOKIE } = loaded.exports;
const cookie = `${SESSION_COOKIE}=${await createSession("local-only-synthetic-passphrase")}`;
const original = "http://localhost:3013";
const rotated = "http://localhost:3014";
const missing = "http://localhost:3015";
assert.equal((await fetch(original, { redirect: "manual", headers: { Cookie: cookie } })).status, 200);
assert.equal((await fetch(rotated, { redirect: "manual", headers: { Cookie: cookie } })).status, 307);
assert.equal((await fetch(rotated + "/api/applications", { headers: { Cookie: cookie } })).status, 401);
for (const [password, status] of [["local-only-synthetic-passphrase", 401], ["rotated-synthetic-passphrase", 200]]) {
  assert.equal((await fetch(rotated + "/api/auth/login", { method: "POST", headers: { Origin: rotated, "Content-Type": "application/json" }, body: JSON.stringify({ password }) })).status, status);
}
for (const path of ["/", "/api/applications", "/api/progress"]) assert.equal((await fetch(missing + path, { redirect: "manual", headers: { Cookie: cookie } })).status, 503);
for (const path of ["/api/auth/login", "/api/ai/parse-job-screenshot"]) assert.equal((await fetch(missing + path, { method: "POST", headers: { Origin: missing, "Content-Type": "application/json" }, body: JSON.stringify({ password: "synthetic" }) })).status, 503);
assert.equal((await fetch(missing + "/login")).status, 200);
console.log("Runtime HTTP checks passed: changed password invalidates old sessions in both Proxy and API; missing password fails closed.");
