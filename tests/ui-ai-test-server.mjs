// Local UI fixture server. Provider and Notion writes are mocked; nothing leaves localhost.
// Start the production app on 3011 with the dummy Basic Auth credentials below first.
import { createServer, request } from "node:http";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

const fixtures = await mkdtemp(join(tmpdir(), "job-screenshot-ui-"));
const image = { create: { width: 360, height: 240, channels: 3, background: "#edf0f3" } };
await sharp(image).png().toFile(join(fixtures, "test.png"));
await sharp(image).jpeg().toFile(join(fixtures, "test.jpg"));
const submissions = [];
let recognitions = 0;
const auth = `Basic ${Buffer.from("test-user:test-password").toString("base64")}`;
const server = createServer(async (req, res) => {
  const json = (data, status = 200) => {
    res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify(data));
  };
  if (req.headers.authorization !== auth) {
    res.writeHead(401, { "WWW-Authenticate": 'Basic realm="Local UI test"' });
    res.end();
    return;
  }
  if (req.url === "/__test/results") return json({ submissions, recognitions });
  if (req.url === "/api/ai/parse-job-screenshot" && req.method === "POST") {
    for await (const chunk of req) { void chunk; }
    recognitions += 1;
    return json({ success: true, job: {
      company: "测试公司", position: "内容运营实习生", base: null, applicationDate: null,
      status: null, officialUrl: null,
      confidence: { company: 0.98, position: 0.54, base: 0, applicationDate: 0, status: 0 },
    } });
  }
  if (req.url === "/api/applications" && req.method === "POST") {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    submissions.push(JSON.parse(Buffer.concat(chunks).toString("utf8")));
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
