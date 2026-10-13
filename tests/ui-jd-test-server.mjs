// Local, read-only JD fixtures for an isolated production build on port 3011.
// Use a synthetic password and no real provider/Notion credentials. Log in at
// http://localhost:3011/login first, then open localhost:3012 for these fixtures.
// Cookies are host-scoped; proxying login across ports correctly fails CSRF.
import { createServer, request } from "node:http";

const appId = (number) => `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const longJd = [
  "工作职责：",
  ...Array.from({ length: 14 }, (_, index) => `${index + 1}. 负责内容整理与项目协作；这是虚构 JD 测试文本，用于验证长段落在手机屏幕中的自然换行。`),
  "", "任职要求：", "- 本科及以上", "- 熟悉协作工具", "",
  "长链接测试：https://example.test/" + "long-path-without-spaces".repeat(24),
  "纯文本测试：<script>不应作为 HTML 执行</script>", "JD 末尾：完整内容保留。",
].join("\n");
const applications = [
  { id: appId(1), company: "JD 长文本测试公司", role: "内容运营实习生", jd: longJd },
  { id: appId(2), company: "JD 短文本测试公司", role: "测试岗位", jd: "工作职责：\n1. 负责内容整理\n2. 参与项目协作\n\n任职要求：\n- 本科及以上\n- 熟悉协作工具" },
  { id: appId(3), company: "JD 空值测试公司", role: "测试岗位", jd: null },
  { id: appId(4), company: "JD 空白测试公司", role: "测试岗位", jd: " \n\t " },
].map((application) => ({ ...application, title: `${application.company}｜${application.role}`, status: "面试中", base: "上海", date: "2026-10-13" }));
const progress = [{
  id: appId(100), applicationIds: [appId(1)], title: "测试公司｜收到一面",
  company: applications[0].company, role: applications[0].role, base: "上海",
  event: "收到一面", stage: "面试", result: "流程中", date: "2026-10-13",
  nextDate: null, note: "模拟进展：确认原有 Timeline 正常展示。", link: null,
}];

const server = createServer(async (req, res) => {
  if (req.method === "GET" && ["/api/applications", "/api/progress"].includes(req.url)) {
    try {
      const check = await fetch("http://127.0.0.1:3011/__test-auth-check", { redirect: "manual", headers: { Cookie: req.headers.cookie ?? "" } });
      if (check.status !== 404) {
        res.writeHead(401, { "Content-Type": "application/json", "Cache-Control": "no-store" });
        return res.end(JSON.stringify({ success: false, error: "请先登录" }));
      }
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      return res.end(JSON.stringify(req.url === "/api/applications" ? { success: true, applications } : { success: true, progress }));
    } catch { res.writeHead(502); return res.end(); }
  }
  const upstream = request({ hostname: "127.0.0.1", port: 3011, path: req.url, method: req.method, headers: req.headers }, (response) => {
    res.writeHead(response.statusCode ?? 500, response.headers);
    response.pipe(res);
  });
  upstream.on("error", () => { if (!res.headersSent) res.writeHead(502); res.end(); });
  req.pipe(upstream);
});
server.listen(3012, "127.0.0.1", () => console.log("JD fixture UI: http://localhost:3012 (synthetic data only)"));
