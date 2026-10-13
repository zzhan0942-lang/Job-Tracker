// Local UI fixture server. Provider and Notion writes are mocked; nothing leaves localhost.
// Start the app on 3011 with a synthetic JOB_TRACKER_ACCESS_PASSWORD first.
import { createServer, request } from "node:http";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

const fixtures = await mkdtemp(join(tmpdir(), "job-screenshot-ui-"));
const image = { create: { width: 360, height: 240, channels: 3, background: "#edf0f3" } };
await sharp(image).png().toFile(join(fixtures, "test.png"));
await sharp(image).jpeg().toFile(join(fixtures, "test.jpg"));
await sharp(image).webp().toFile(join(fixtures, "test.webp"));
const submissions = [];
let recognitions = 0;
// Check the real application's auth boundary before serving mock business data.
const server = createServer(async (req, res) => {
  const json = (data, status = 200) => {
    res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify(data));
  };
  if (req.url.startsWith("/api/") && !req.url.startsWith("/api/auth/")) {
    const check = await fetch("http://127.0.0.1:3011/__test-auth-check", { redirect: "manual", headers: { Cookie: req.headers.cookie ?? "" } });
    if (check.status !== 404) return json({ success: false, error: "请先登录" }, 401);
  }
  if (req.url === "/__test/results") return json({ submissions, recognitions });
  if (req.url === "/api/ai/parse-job-screenshot" && req.method === "POST") {
    for await (const chunk of req) { void chunk; }
    recognitions += 1;
    return json({ success: true, job: {
      company: "测试公司", position: "内容运营实习生", base: null, applicationDate: null,
      status: null, officialUrl: null, jobDescription: "工作职责\n1. 整理内容与反馈\n任职要求\n1. 熟悉协作工具",
      confidence: { company: 0.98, position: 0.54, base: 0, applicationDate: 0, status: 0 },
    } });
  }
  if (req.url === "/api/applications" && req.method === "POST") {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (input.jobDescription && process.env.UI_TEST_HAS_JD === "false") {
      return json({ success: false, error: "JD 尚未保存：请先在 Notion Applications 新增名为“JD”的文本（rich_text）字段，再重试。表单内容已保留。" }, 409);
    }
    submissions.push(input);
    return json({ success: true, id: "00000000-0000-4000-8000-000000000001" });
  }
  if (req.url === "/api/applications" && req.method === "GET") return json({ success: true, applications: [] });
  if (req.url === "/api/progress" && req.method === "GET") return json({ success: true, progress: [] });
  const upstream = request({ hostname: "127.0.0.1", port: 3011, path: req.url, method: req.method, headers: req.headers }, (response) => {
    res.writeHead(response.statusCode ?? 500, response.headers);
    response.pipe(res);
  });
  upstream.on("error", () => { if (!res.headersSent) res.writeHead(502); res.end(); });
  req.pipe(upstream);
});
server.listen(3012, "127.0.0.1", () => console.log(`Local UI test: http://127.0.0.1:3012; fixtures: ${fixtures}`));
