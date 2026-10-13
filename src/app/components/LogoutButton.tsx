"use client";
import { useState } from "react";

export default function LogoutButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("logout_failed");
      window.location.replace("/login");
    } catch { setError("退出失败，请重试"); setBusy(false); }
  }
  return <div><button type="button" disabled={busy} onClick={logout} className="h-11 rounded-full border border-neutral-200 bg-white px-4 text-sm shadow-sm disabled:opacity-50 dark:border-neutral-800 dark:bg-[#171719]">{busy ? "正在退出…" : "退出登录"}</button>{error && <p role="alert" className="mt-1 text-xs text-red-500">{error}</p>}</div>;
}
