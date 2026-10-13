import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nativeRequire = createRequire(import.meta.url);
const modules = new Map();
function loadSource(filename) {
  if (modules.has(filename)) return modules.get(filename).exports;
  const loadedModule = { exports: {} };
  modules.set(filename, loadedModule);
  const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  });
  function requireSource(specifier) {
    if (specifier === "server-only") return {};
    if (specifier.startsWith("@/") || specifier.startsWith(".")) {
      const target = specifier.startsWith("@/") ? resolve(root, "src", specifier.slice(2)) : resolve(dirname(filename), specifier);
      for (const suffix of [".ts", ".tsx"]) if (existsSync(target + suffix)) return loadSource(target + suffix);
    }
    return nativeRequire(specifier);
  }
  new Function("require", "module", "exports", outputText)(requireSource, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}

const id = "00000000-0000-4000-8000-000000000001";
let jdProperty;
let reads = 0;
const writes = [];
modules.set(resolve(root, "src/lib/notion-data.ts"), { exports: {
  applicationsDataSourceId: () => "mock-applications",
  getDataSourcePages: async () => {
    reads++;
    return [{ id, properties: {
      公司名称: { type: "rich_text", rich_text: [{ plain_text: "测试公司" }] },
      岗位名称: { type: "rich_text", rich_text: [{ plain_text: "测试岗位" }] },
      岗位标识: { type: "title", title: [{ plain_text: "测试公司｜测试岗位" }] },
      Base: { type: "rich_text", rich_text: [{ plain_text: "上海" }] },
      投递状态: { status: { name: "已投递" } }, 日期: { date: { start: "2026-10-13" } },
      ...(jdProperty === undefined ? {} : { JD: jdProperty }),
    } }];
  },
  notion: { pages: { create: async (value) => writes.push(value), update: async (value) => writes.push(value) } },
} });
const { GET } = loadSource(resolve(root, "src/app/api/applications/route.ts"));
const { createSession, SESSION_COOKIE } = loadSource(resolve(root, "src/lib/api-auth.ts"));
process.env.JOB_TRACKER_ACCESS_PASSWORD = "synthetic-jd-test-passphrase";
const cookie = `${SESSION_COOKIE}=${await createSession(process.env.JOB_TRACKER_ACCESS_PASSWORD)}`;
const ApplicationJd = loadSource(resolve(root, "src/app/components/ApplicationJd.tsx")).default;

test("Applications GET maps existing JD rich text without altering whitespace, chunk boundaries or list fields", async () => {
  const parts = ["  工作职责：\n1. 负责内容\n", "2. 参与协作\n\n任职要求：\n", "- 本科及以上\n- 熟悉工具\n  "];
  jdProperty = { type: "rich_text", rich_text: parts.map((plain_text) => ({ plain_text })) };
  const response = await GET(new Request("http://localhost/api/applications", { headers: { Cookie: cookie } }));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.count, 1);
  assert.deepEqual(result.applications[0], {
    id, company: "测试公司", role: "测试岗位", title: "测试公司｜测试岗位", status: "已投递", base: "上海", date: "2026-10-13", jd: parts.join(""),
  });
  assert.equal(writes.length, 0);
});

test("missing or empty JD maps to null; whitespace is not rewritten; auth still gates reads", async () => {
  for (const [property, expected] of [[undefined, null], [{ type: "rich_text", rich_text: [] }, null], [{ type: "rich_text", rich_text: [{ plain_text: " \n\t " }] }, " \n\t "]]) {
    jdProperty = property;
    const response = await GET(new Request("http://localhost/api/applications", { headers: { Cookie: cookie } }));
    assert.equal((await response.json()).applications[0].jd, expected);
  }
  const before = reads;
  assert.equal((await GET(new Request("http://localhost/api/applications"))).status, 401);
  assert.equal(reads, before);
  assert.equal(writes.length, 0);
});

test("JD card hides absent/null/whitespace content, preserves all text and escapes HTML", () => {
  for (const jd of [undefined, null, "", " \n\t "]) assert.equal(renderToStaticMarkup(React.createElement(ApplicationJd, { jd })), "");
  const jd = "工作职责：\n1. 负责……\n2. 参与……\n\n任职要求：\n- 熟悉工具\n<script>unsafe()</script>";
  const html = renderToStaticMarkup(React.createElement(ApplicationJd, { jd }));
  assert.ok(html.includes("JD / 职位描述"));
  assert.ok(html.includes(jd.replace("<script>", "&lt;script&gt;").replace("</script>", "&lt;/script&gt;")));
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("whitespace-pre-wrap"));
  assert.ok(html.includes("overflow-wrap:anywhere"));
  assert.ok(html.includes("dark:text-neutral-300"));
  const long = "岗位职责\n".repeat(300) + "末尾完整保留";
  assert.ok(renderToStaticMarkup(React.createElement(ApplicationJd, { jd: long })).includes(long));
});
