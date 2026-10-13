"use client";

import { useEffect, useState, type FormEvent } from "react";

export default function Login() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const mode = localStorage.getItem("job-tracker-theme");
    document.documentElement.dataset.theme = mode === "dark" || (mode !== "light" && matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
  }, []);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const data = await response.json();
      if (!response.ok) { setError(data.error ?? "登录失败，请稍后重试"); return; }
      setPassword("");
      const next = new URLSearchParams(window.location.search).get("next");
      const target = next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? new URL(next, window.location.origin) : null;
      window.location.replace(target && target.origin === window.location.origin && target.pathname !== "/login" && !target.pathname.startsWith("/api/") ? target.pathname + target.search : "/");
    } catch { setError("无法连接，请稍后重试"); }
    finally { setBusy(false); }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground">
      <section className="w-full max-w-sm rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8 dark:border-neutral-800 dark:bg-[#171719]">
        <p className="text-xs tracking-[0.18em] text-neutral-500">JOB TRACKER</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">登录求职控制台</h1>
        <p className="mt-3 text-sm leading-6 text-neutral-500">输入访问密码，继续查看与管理你的求职记录。</p>
        <form onSubmit={login} className="mt-6 space-y-4">
          <div>
            <label htmlFor="access-password" className="mb-2 block text-sm">访问密码</label>
            <input id="access-password" name="password" type="password" autoComplete="current-password" required maxLength={1024} value={password} onChange={(event) => setPassword(event.target.value)} aria-describedby={error ? "login-error" : undefined} className="h-12 w-full min-w-0 rounded-xl border border-neutral-200 bg-transparent px-3 text-base outline-none focus:border-neutral-500 dark:border-neutral-700" />
          </div>
          {error && <p id="login-error" role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button disabled={busy} className="h-12 w-full rounded-xl bg-neutral-900 text-sm font-medium text-white transition disabled:opacity-50 dark:bg-white dark:text-neutral-900">{busy ? "正在登录…" : "登录"}</button>
        </form>
      </section>
    </main>
  );
}
