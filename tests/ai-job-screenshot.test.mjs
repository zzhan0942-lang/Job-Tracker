import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import ts from "typescript";

// Use the project's existing TypeScript compiler; no test runner or real credentials.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nativeRequire = createRequire(import.meta.url);
const modules = new Map();
function loadSource(filename) {
  if (modules.has(filename)) return modules.get(filename).exports;
  const loadedModule = { exports: {} };
  modules.set(filename, loadedModule);
  const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  });
  const requireSource = (specifier) => {
    if (specifier === "server-only") return {};
    if (specifier.startsWith("@/") || specifier.startsWith(".")) {
      const target = specifier.startsWith("@/")
        ? resolve(root, "src", specifier.slice(2))
        : resolve(dirname(filename), specifier);
      if (existsSync(`${target}.ts`)) return loadSource(`${target}.ts`);
    }
    return nativeRequire(specifier);
  };
  new Function("require", "module", "exports", outputText)(requireSource, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}

const { parseJobScreenshotResult, MAX_SCREENSHOT_BYTES, SCREENSHOT_ERROR } = loadSource(resolve(root, "src/lib/job-screenshot.ts"));
const { POST } = loadSource(resolve(root, "src/app/api/ai/parse-job-screenshot/route.ts"));
const { matchesImageSignature } = loadSource(resolve(root, "src/lib/screenshot-upload.ts"));
const { parseApplicationInput } = loadSource(resolve(root, "src/lib/api-validation.ts"));
const notionCreates = [];
modules.set(resolve(root, "src/lib/notion-data.ts"), { exports: {
  applicationsDataSourceId: () => "00000000-0000-4000-8000-000000000002",
  notion: { pages: { create: async (payload) => { notionCreates.push(payload); return { id: "test-created-page" }; } } },
} });
const { POST: createApplication } = loadSource(resolve(root, "src/app/api/applications/route.ts"));
const sharp = nativeRequire("sharp");
const image = { create: { width: 2, height: 2, channels: 3, background: "white" } };
const fixtures = {
  "image/png": await sharp(image).png().toBuffer(),
  "image/jpeg": await sharp(image).jpeg().toBuffer(),
  "image/webp": await sharp(image).webp().toBuffer(),
};
const knownJob = {
  company: "测试公司", position: "内容运营", base: "上海", applicationDate: "2026-10-13",
  status: "已投递", officialUrl: "https://example.com/jobs",
  confidence: { company: 0.98, position: 0.95, base: 0.82, applicationDate: 0.54, status: 0.91 },
};
const auth = `Basic ${Buffer.from("test-user:test-password").toString("base64")}`;
process.env.JOB_TRACKER_AUTH_USERNAME = "test-user";
process.env.JOB_TRACKER_AUTH_PASSWORD = "test-password";
process.env.DEEPSEEK_API_KEY = "fake-test-key";

function request(type = "image/png", body = fixtures[type], authorized = true, extraHeaders = {}) {
  return new Request("http://localhost/api/ai/parse-job-screenshot", {
    method: "POST", body,
    headers: { "Content-Type": type, ...(authorized ? { Authorization: auth } : {}), ...extraHeaders },
  });
}

function mockModel(job, overrides = {}) {
  return Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(job) }, ...overrides }] });
}

test("PNG, JPEG and WebP use the authenticated DeepSeek image request and return validated fields", async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const [mime, bytes] of Object.entries(fixtures)) {
      globalThis.fetch = async (url, options) => {
        assert.equal(url, "https://api.deepseek.com/chat/completions");
        const payload = JSON.parse(options.body);
        assert.equal(payload.model, "deepseek-flash");
        assert.equal(payload.response_format.type, "json_object");
        assert.equal(payload.messages[1].content[1].image_url.url, `data:${mime};base64,${bytes.toString("base64")}`);
        return mockModel(knownJob);
      };
      const response = await POST(request(mime));
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.deepEqual((await response.json()).job, knownJob);
    }
  } finally { globalThis.fetch = originalFetch; }
});

test("missing fields remain null including date and status; partial jobs remain editable", async () => {
  const partial = { ...knownJob, base: null, applicationDate: null, status: null, officialUrl: null };
  assert.deepEqual(parseJobScreenshotResult(partial), partial);
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => mockModel(partial);
    const response = await POST(request());
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).job, partial);
    const edited = { company: partial.company, role: "用户修改后的岗位", base: "", date: "", status: "面试中", note: "", url: "" };
    assert.equal(parseApplicationInput(edited, false)?.role, "用户修改后的岗位");
    assert.equal(parseApplicationInput(edited, false)?.date, null);
    assert.equal(parseApplicationInput({ ...edited, status: "" }, false), null);
  } finally { globalThis.fetch = originalFetch; }
});

test("reject invalid model dates, enum values, URLs, types, extra keys and confidence", () => {
  for (const invalid of [
    { ...knownJob, applicationDate: "2026-02-30" },
    { ...knownJob, applicationDate: "2026-10" },
    { ...knownJob, status: "简历审核" },
    { ...knownJob, officialUrl: "javascript:alert(1)" },
    { ...knownJob, company: 123 },
    { ...knownJob, extra: "not allowed" },
    { ...knownJob, confidence: { ...knownJob.confidence, company: 1.1 } },
    { ...knownJob, confidence: { ...knownJob.confidence, status: "0.8" } },
    { ...knownJob, position: "x".repeat(201) },
  ]) assert.equal(parseJobScreenshotResult(invalid), null);
});

test("manual and edited AI submissions use the original API and correct Notion properties (mock)", async () => {
  for (const input of [
    { company: "手动公司", role: "手动岗位", base: "上海", date: "2026-10-13", status: "已投递", note: "手动备注", url: "https://example.com/manual" },
    { company: "测试公司", role: "用户修改后的岗位", base: "", date: "", status: "面试中", note: "", url: "" },
  ]) {
    const response = await createApplication(new Request("http://localhost/api/applications", {
      method: "POST", headers: { Authorization: auth, "Content-Type": "application/json" }, body: JSON.stringify(input),
    }));
    assert.equal(response.status, 200);
    const properties = notionCreates.at(-1).properties;
    assert.equal(properties["公司名称"].rich_text[0].text.content, input.company);
    assert.equal(properties["岗位名称"].rich_text[0].text.content, input.role);
    assert.equal(properties["投递状态"].status.name, input.status);
    assert.deepEqual(properties["日期"].date, input.date ? { start: input.date } : null);
    assert.equal(properties["官网链接"].url, input.url || null);
  }
});

test("auth, unsupported types, mislabeled non-images, empty and oversized files never reach DeepSeek", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => { throw new Error("Provider must not be called"); };
    for (const [input, status] of [
      [request("image/png", fixtures["image/png"], false), 401],
      [request("text/plain", "not an image"), 415],
      [request("image/png", "not an image"), 415],
      [request("image/png", new Uint8Array()), 400],
      [request("image/png", new Uint8Array(MAX_SCREENSHOT_BYTES + 1)), 413],
      [request("image/png", fixtures["image/png"], true, { "Content-Length": String(MAX_SCREENSHOT_BYTES + 1) }), 413],
    ]) assert.equal((await POST(input)).status, status);
    assert.equal(matchesImageSignature(fixtures["image/jpeg"], "image/png"), false);
  } finally { globalThis.fetch = originalFetch; }
});

test("missing key, timeout, non-JSON, invalid fields, no job and provider errors fail safely", async () => {
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const logs = [];
  console.error = (...args) => logs.push(args);
  try {
    process.env.DEEPSEEK_API_KEY = "";
    let response = await POST(request());
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { success: false, error: SCREENSHOT_ERROR });
    process.env.DEEPSEEK_API_KEY = "fake-test-key";
    for (const [provider, status] of [
      [async () => { throw new DOMException("private timeout detail", "TimeoutError"); }, 504],
      [async () => new Response("private non-JSON response"), 502],
      [async () => mockModel({ ...knownJob, status: "not valid" }), 502],
      [async () => mockModel({ ...knownJob, company: null, position: null }), 502],
      [async () => mockModel(knownJob, { finish_reason: "length" }), 502],
      [async () => new Response("private provider failure", { status: 401 }), 502],
      [async () => new Response("x".repeat(65 * 1024)), 502],
    ]) {
      globalThis.fetch = provider;
      response = await POST(request());
      assert.equal(response.status, status);
      assert.deepEqual(await response.json(), { success: false, error: SCREENSHOT_ERROR });
    }
    assert.ok(!JSON.stringify(logs).includes("private"));
    assert.ok(!JSON.stringify(logs).includes("fake-test-key"));
    assert.ok(!JSON.stringify(logs).includes(knownJob.company));
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
    delete process.env.DEEPSEEK_API_KEY;
  }
});
