"use client";

import { FormEvent, useState } from "react";

function getToday() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(
    now.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    now.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export default function AddApplicationModal() {
  const [open, setOpen] = useState(false);

  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [base, setBase] = useState("");
  const [status, setStatus] = useState("已投递");
  const [date, setDate] = useState(getToday());
  const [note, setNote] = useState("");
  const [url, setUrl] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!company.trim() || !role.trim()) {
      setError("请填写公司名称和岗位名称");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const response = await fetch(
        "/api/applications",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            company: company.trim(),
            role: role.trim(),
            base: base.trim(),
            status,
            date,
            note: note.trim(),
            url: url.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "新增岗位失败"
        );
      }

      setOpen(false);

      // 保存成功后重新读取 Notion
      window.location.reload();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "新增岗位失败"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="whitespace-nowrap rounded-full bg-neutral-900 px-3.5 py-2 text-sm text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200 sm:px-4"
      >
        + 新增岗位
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/30 p-3 backdrop-blur-sm sm:p-4">
          <div className="my-auto max-h-[calc(100dvh-24px)] w-full max-w-xl overflow-y-auto overscroll-contain rounded-[24px] bg-white p-5 shadow-2xl dark:bg-[#171719] sm:max-h-[90vh] sm:rounded-[30px] sm:p-7">
            <div className="mb-5 flex items-start justify-between gap-4 sm:mb-7">
              <div className="min-w-0">
                <p className="text-[10px] font-medium tracking-[0.14em] text-neutral-400 sm:text-xs sm:tracking-[0.16em]">
                  NEW APPLICATION
                </p>

                <h2 className="mt-1 text-xl font-semibold sm:text-2xl">
                  新增岗位
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-lg text-neutral-500 transition hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                aria-label="关闭"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-4 sm:space-y-5"
            >
              <div>
                <label className="mb-2 block text-sm font-medium">
                  公司名称
                </label>

                <input
                  value={company}
                  onChange={(e) =>
                    setCompany(e.target.value)
                  }
                  placeholder="例如：小红书"
                  className="w-full min-w-0 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-base outline-none transition focus:border-neutral-400 dark:border-neutral-700 dark:bg-[#111113] dark:focus:border-neutral-500 sm:text-sm"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  岗位名称
                </label>

                <input
                  value={role}
                  onChange={(e) =>
                    setRole(e.target.value)
                  }
                  placeholder="例如：内容运营"
                  className="w-full min-w-0 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-base outline-none transition focus:border-neutral-400 dark:border-neutral-700 dark:bg-[#111113] dark:focus:border-neutral-500 sm:text-sm"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <label className="mb-2 block text-sm font-medium">
                    Base
                  </label>

                  <input
                    value={base}
                    onChange={(e) =>
                      setBase(e.target.value)
                    }
                    placeholder="上海"
                    className="w-full min-w-0 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-base outline-none transition focus:border-neutral-400 dark:border-neutral-700 dark:bg-[#111113] dark:focus:border-neutral-500 sm:text-sm"
                  />
                </div>

                <div className="min-w-0">
                  <label className="mb-2 block text-sm font-medium">
                    日期
                  </label>

                  <input
                    type="date"
                    value={date}
                    onChange={(e) =>
                      setDate(e.target.value)
                    }
                    className="w-full min-w-0 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-base outline-none transition focus:border-neutral-400 dark:border-neutral-700 dark:bg-[#111113] dark:focus:border-neutral-500 sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  投递状态
                </label>

                <select
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value)
                  }
                  className="w-full min-w-0 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-base outline-none transition focus:border-neutral-400 dark:border-neutral-700 dark:bg-[#111113] dark:focus:border-neutral-500 sm:text-sm"
                >
                  <option value="未投递">
                    未投递
                  </option>

                  <option value="已投递">
                    已投递
                  </option>

                  <option value="测评中">
                    测评中
                  </option>

                  <option value="已测评">
                    已测评
                  </option>

                  <option value="笔试中">
                    笔试中
                  </option>

                  <option value="已笔试">
                    已笔试
                  </option>

                  <option value="面试中">
                    面试中
                  </option>

                  <option value="已挂">
                    已挂
                  </option>

                  <option value="收到offer">
                    收到offer
                  </option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  官网 / JD 链接
                </label>

                <input
                  value={url}
                  onChange={(e) =>
                    setUrl(e.target.value)
                  }
                  placeholder="https://..."
                  inputMode="url"
                  className="w-full min-w-0 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-base outline-none transition focus:border-neutral-400 dark:border-neutral-700 dark:bg-[#111113] dark:focus:border-neutral-500 sm:text-sm"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  备注
                </label>

                <textarea
                  value={note}
                  onChange={(e) =>
                    setNote(e.target.value)
                  }
                  placeholder="例如：内推、岗位要求、联系人等"
                  rows={3}
                  className="w-full min-w-0 resize-none rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-base outline-none transition focus:border-neutral-400 dark:border-neutral-700 dark:bg-[#111113] dark:focus:border-neutral-500 sm:text-sm"
                />
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/50 dark:text-red-300">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-1 sm:flex sm:justify-end sm:pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="w-full rounded-full border border-neutral-200 px-4 py-2.5 text-sm dark:border-neutral-700 sm:w-auto sm:px-5"
                >
                  取消
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full rounded-full bg-neutral-900 px-4 py-2.5 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900 sm:w-auto sm:px-6"
                >
                  {saving
                    ? "正在保存..."
                    : "保存岗位"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
