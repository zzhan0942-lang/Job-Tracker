"use client";

import { FormEvent, useEffect, useState } from "react";

type Application = {
  id: string;
  company: string;
  role: string;
  title: string;
  status: string;
  base: string;
  date: string | null;
};

type Props = {
  application: Application;
};

export default function EditApplicationModal({
  application,
}: Props) {
  const [open, setOpen] = useState(false);

  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [base, setBase] = useState("");
  const [status, setStatus] = useState("");
  const [date, setDate] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setCompany(application.company || "");
    setRole(application.role || "");
    setBase(application.base || "");
    setStatus(application.status || "已投递");
    setDate(application.date || "");
  }, [application]);

  async function handleSubmit(
    e: FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

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
          method: "PATCH",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            id: application.id,
            company: company.trim(),
            role: role.trim(),
            base: base.trim(),
            status,
            date,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "修改失败"
        );
      }

      setOpen(false);
      window.location.reload();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "修改失败"
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
        className="whitespace-nowrap rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm transition hover:bg-neutral-100"
      >
        编辑岗位
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/30 p-3 backdrop-blur-sm sm:p-4">
          <div className="my-auto max-h-[calc(100dvh-24px)] w-full max-w-xl overflow-y-auto overscroll-contain rounded-[24px] bg-white p-5 shadow-2xl sm:max-h-[90vh] sm:rounded-[30px] sm:p-7">
            <div className="mb-5 flex items-start justify-between gap-4 sm:mb-7">
              <div className="min-w-0">
                <p className="text-[10px] font-medium tracking-[0.14em] text-neutral-400 sm:text-xs sm:tracking-[0.16em]">
                  EDIT APPLICATION
                </p>

                <h2 className="mt-1 text-xl font-semibold sm:text-2xl">
                  编辑岗位
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-lg text-neutral-500 transition hover:bg-neutral-200"
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
                  className="w-full min-w-0 rounded-2xl border border-neutral-200 px-4 py-3 text-base outline-none transition focus:border-neutral-400 sm:text-sm"
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
                  className="w-full min-w-0 rounded-2xl border border-neutral-200 px-4 py-3 text-base outline-none transition focus:border-neutral-400 sm:text-sm"
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
                    className="w-full min-w-0 rounded-2xl border border-neutral-200 px-4 py-3 text-base outline-none transition focus:border-neutral-400 sm:text-sm"
                  />
                </div>

                <div className="min-w-0">
                  <label className="mb-2 block text-sm font-medium">
                    投递日期
                  </label>

                  <input
                    type="date"
                    value={date}
                    onChange={(e) =>
                      setDate(e.target.value)
                    }
                    className="w-full min-w-0 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-base outline-none transition focus:border-neutral-400 sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  当前状态
                </label>

                <select
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value)
                  }
                  className="w-full min-w-0 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-base outline-none transition focus:border-neutral-400 sm:text-sm"
                >
                  <option>未投递</option>
                  <option>已投递</option>
                  <option>测评中</option>
                  <option>已测评</option>
                  <option>笔试中</option>
                  <option>已笔试</option>
                  <option>面试中</option>
                  <option>已挂</option>
                  <option value="收到offer">
                    收到 Offer
                  </option>
                </select>
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-1 sm:flex sm:justify-end sm:pt-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="w-full rounded-full border border-neutral-200 px-4 py-2.5 text-sm sm:w-auto sm:px-5"
                >
                  取消
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full rounded-full bg-neutral-900 px-4 py-2.5 text-sm text-white disabled:opacity-50 sm:w-auto sm:px-6"
                >
                  {saving
                    ? "保存中..."
                    : "保存修改"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
