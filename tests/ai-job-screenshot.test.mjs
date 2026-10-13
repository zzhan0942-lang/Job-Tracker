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
const { normalizeJobScreenshotResponse, parseJobScreenshotResponse } = loadSource(resolve(root, "src/lib/job-screenshot-response.ts"));
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
  const withEvidence = job && !Array.isArray(job) && job.applicationDate
    ? { applicationDateEvidence: `投递时间：${job.applicationDate}`, ...job }
    : job;
  return Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(withEvidence) }, ...overrides }] });
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
    assert.deepEqual((await response.json()).job, {
      ...partial,
      confidence: { ...partial.confidence, base: 0, applicationDate: 0, status: 0 },
    });
    const edited = { company: partial.company, role: "用户修改后的岗位", base: "", date: "", status: "面试中", note: "", url: "" };
    assert.equal(parseApplicationInput(edited, false)?.role, "用户修改后的岗位");
    assert.equal(parseApplicationInput(edited, false)?.date, null);
    assert.equal(parseApplicationInput({ ...edited, status: "" }, false), null);
  } finally { globalThis.fetch = originalFetch; }
});

test("the final canonical schema still rejects unsafe or noncanonical values", () => {
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

test("normalize nullable/missing fields, whitespace, empty URLs, base arrays and extra provider keys", () => {
  const parsed = normalizeJobScreenshotResponse({
    company: " 测试公司 ", position: " 内容运营 ", base: [" 北京 ", "上海", ""],
    applicationDate: "", status: null, officialUrl: " ", extra: "ignored private text",
  });
  assert.equal(parsed.failure, null);
  assert.deepEqual(parsed.job, {
    company: "测试公司", position: "内容运营", base: "北京，上海",
    applicationDate: null, status: null, officialUrl: null,
    confidence: { company: 0, position: 0, base: 0, applicationDate: 0, status: 0 },
  });
  for (const input of [["上海"], [], { city: "上海" }, 123, ["上海", {}]]) {
    const result = normalizeJobScreenshotResponse({ ...knownJob, base: input });
    assert.equal(result.failure, null);
    assert.equal(result.job.base, Array.isArray(input) && input.length === 1 ? "上海" : null);
  }
  const allNull = normalizeJobScreenshotResponse({ company: null, position: null, base: null, applicationDate: null, status: null, officialUrl: null });
  assert.equal(allNull.failure, null);
  assert.equal(allNull.job.company, null);
  assert.equal(allNull.job.status, null);
});

test("only explicit application statuses are mapped; recruitment labels and unknown values become null", () => {
  for (const status of ["校园招聘", "招聘中", "职位开放", "JD", "待申请", "简历审核", "", null, undefined, { status: "已投递" }, "not valid", "toString", "__proto__"]) {
    const parsed = normalizeJobScreenshotResponse({ ...knownJob, status });
    assert.equal(parsed.failure, null);
    assert.equal(parsed.job.status, null);
    assert.equal(parsed.job.confidence.status, 0);
  }
  for (const status of ["简历已提交", " 投递成功 ", "申请已提交"]) {
    assert.equal(normalizeJobScreenshotResponse({ ...knownJob, status }).job.status, "已投递");
  }
  for (const status of ["未投递", "测评中", "已测评", "笔试中", "已笔试", "面试中", "已挂", "收到offer"]) {
    assert.equal(normalizeJobScreenshotResponse({ ...knownJob, status }).job.status, status);
  }
});

test("publication/update dates and bare dates stay null; explicit matching application-date evidence is required", () => {
  for (const fields of [
    { applicationDate: "2026-09-10 发布" },
    { applicationDate: "发布日期：2026-09-10" },
    { applicationDate: "2026-09-10", applicationDateEvidence: "职位发布时间：2026-09-10" },
    { applicationDate: "2026-09-10", applicationDateEvidence: "更新日期：2026-09-10" },
    { applicationDate: "2026-09-10", applicationDateEvidence: "面试时间：2026-09-10" },
    { applicationDate: "2026-09-10" },
    { applicationDate: "2026-09-10", applicationDateEvidence: "投递时间" },
    { applicationDate: "2026-09-10", applicationDateEvidence: "申请时间：2026-09-11" },
    { applicationDate: "2026-02-30", applicationDateEvidence: "投递日期：2026-02-30" },
    { applicationDate: "09-10", applicationDateEvidence: "申请时间：09-10" },
  ]) {
    const parsed = normalizeJobScreenshotResponse({ ...knownJob, ...fields });
    assert.equal(parsed.failure, null);
    assert.equal(parsed.job.applicationDate, null);
    assert.equal(parsed.job.confidence.applicationDate, 0);
  }
  for (const fields of [
    { applicationDate: "2026-09-10", applicationDateEvidence: "已投递时间：2026-09-10" },
    { applicationDate: "2026-09-10", applicationDateEvidence: "申请时间：2026年9月10日 12:30" },
    { applicationDate: "投递日期：2026/9/10" },
  ]) assert.equal(normalizeJobScreenshotResponse({ ...knownJob, ...fields }).job.applicationDate, "2026-09-10");
});

test("confidence strings are converted and clamped; missing or malformed confidence never rejects a job", () => {
  const parsed = normalizeJobScreenshotResponse({ ...knownJob, confidence: {
    company: "0.95", position: "1.2", base: -1, applicationDate: {}, status: "bad",
  } });
  assert.equal(parsed.failure, null);
  assert.deepEqual(parsed.job.confidence, { company: 0.95, position: 1, base: 0, applicationDate: 0, status: 0 });
  for (const confidence of [undefined, null, "0.95", [], { company: false }, { company: "" }, { company: "Infinity" }, { company: "0xff" }]) {
    const normalized = normalizeJobScreenshotResponse({ ...knownJob, confidence });
    assert.equal(normalized.failure, null);
    assert.ok(Object.values(normalized.job.confidence).every((value) => Number.isFinite(value) && value >= 0 && value <= 1));
  }
});

test("JSON fences are accepted without evaluating or extracting ambiguous prose; diagnostics contain no values", () => {
  for (const content of [JSON.stringify(knownJob), `\n\uFEFF\n\x60\x60\x60json\n${JSON.stringify(knownJob)}\n\x60\x60\x60\n`, `\x60\x60\x60\n${JSON.stringify(knownJob)}\n\x60\x60\x60`]) {
    assert.equal(parseJobScreenshotResponse(content).failure, null);
  }
  for (const content of ["private malformed JSON", `Here is JSON: ${JSON.stringify(knownJob)}`, '{"company":"private truncated text"', '{}\n{}']) {
    const parsed = parseJobScreenshotResponse(content);
    assert.equal(parsed.failure, "invalid_json");
    assert.deepEqual(parsed.issues, [{ field: "response", type: "string", reason: "invalid_json" }]);
  }
  for (const value of [null, [], "private text", 123]) {
    const parsed = normalizeJobScreenshotResponse(value);
    assert.equal(parsed.failure, "invalid_fields");
    assert.equal(parsed.issues[0].field, "response");
    assert.equal(parsed.issues[0].reason, "expected_object");
  }
  const parsed = normalizeJobScreenshotResponse({ ...knownJob, company: { private: "private name" }, status: "private status", confidence: { company: "private score" } });
  assert.ok(parsed.issues.some((issue) => issue.field === "company" && issue.type === "object" && issue.reason === "expected_string"));
  assert.ok(parsed.issues.some((issue) => issue.field === "confidence.company" && issue.reason === "expected_number"));
  assert.ok(!JSON.stringify(parsed.issues).includes("private"));
  assert.ok(!JSON.stringify(parsed.issues).includes(knownJob.company));
});

test("a realistic fenced response with base array, recruitment status and absent confidence succeeds at the route", async () => {
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  const logs = [];
  console.warn = (...args) => logs.push(args);
  try {
    globalThis.fetch = async () => mockModel(null, { message: { content: `\x60\x60\x60json\n${JSON.stringify({
      company: "测试公司", position: "内容运营", base: ["上海"], applicationDate: "2026-09-10 发布", status: "校园招聘", officialUrl: "",
    })}\n\x60\x60\x60` } });
    const response = await POST(request());
    assert.equal(response.status, 200);
    const { job } = await response.json();
    assert.equal(job.base, "上海");
    assert.equal(job.applicationDate, null);
    assert.equal(job.status, null);
    assert.equal(job.officialUrl, null);
    assert.deepEqual(job.confidence, { company: 0, position: 0, base: 0, applicationDate: 0, status: 0 });
    assert.ok(logs.some((entry) => entry[1].issues.some((issue) => issue.field === "status" && issue.reason === "unmapped_status")));
    assert.ok(!JSON.stringify(logs).includes("校园招聘"));
    assert.ok(!JSON.stringify(logs).includes("2026-09-10"));
    assert.ok(!JSON.stringify(logs).includes(knownJob.company));
    assert.ok(!JSON.stringify(logs).includes("fake-test-key"));
  } finally { globalThis.fetch = originalFetch; console.warn = originalWarn; }
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
  const originalWarn = console.warn;
  const logs = [];
  console.error = (...args) => logs.push(args);
  console.warn = (...args) => logs.push(args);
  try {
    process.env.DEEPSEEK_API_KEY = "";
    let response = await POST(request());
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { success: false, error: SCREENSHOT_ERROR });
    process.env.DEEPSEEK_API_KEY = "fake-test-key";
    for (const [provider, status] of [
      [async () => { throw new DOMException("private timeout detail", "TimeoutError"); }, 504],
      [async () => new Response("private non-JSON response"), 502],
      [async () => mockModel([knownJob]), 502],
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
    assert.ok(logs.some((entry) => entry[0] === "AI response validation failed" && entry[1].issues.some((issue) => issue.reason === "expected_object")));
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
    console.warn = originalWarn;
    delete process.env.DEEPSEEK_API_KEY;
  }
});
