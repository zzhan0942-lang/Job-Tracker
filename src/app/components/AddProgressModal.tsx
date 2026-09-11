"use client";

import { FormEvent, useState } from "react";

type Props = {
  applicationId: string;
  company: string;
  role: string;
  onSuccess?: () => void | Promise<void>;
  variant?: "primary" | "secondary";
};

const eventOptions = [
  "投递",
  "收到测评",
  "完成测评",
  "收到笔试",
  "完成笔试",
  "收到AI面",
  "完成AI面",
  "收到一面",
  "完成一面",
  "收到二面",
  "完成二面",
  "收到三面",
  "完成三面",
  "收到HR面",
  "完成HR面",
  "收到Offer",
  "淘汰",
  "主动放弃",
  "流程暂停",
  "其他",
];

function getToday() {
  const now = new Date();

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

function getStage(event: string) {
  if (event.includes("测评")) return "测评";
  if (event.includes("笔试")) return "笔试";
  if (event.includes("AI面")) return "AI面";

  if (
    event.includes("一面") ||
    event.includes("二面") ||
    event.includes("三面")
  ) {
    return "面试";
  }

  if (event.includes("HR")) return "HR";
  if (event.includes("Offer")) return "Offer";

  return "投递";
}

function getResult(event: string) {
  if (event === "淘汰") return "淘汰";
  if (event === "主动放弃") return "主动放弃";
  if (event === "收到Offer") return "Offer";
  if (event === "流程暂停") return "待定";

  if (event.startsWith("收到") || event === "投递") {
    return "流程中";
  }

  return "待定";
}

export default function AddProgressModal({
  applicationId,
  company,
  role,
  onSuccess,
  variant = "primary",
}: Props) {
  const [open, setOpen] = useState(false);
  const [event, setEvent] = useState("收到测评");
  const [date, setDate] = useState(getToday());
  const [result, setResult] = useState("待定");
  const [nextDate, setNextDate] = useState("");
  const [note, setNote] = useState("");
  const [link, setLink] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function handleEventChange(value: string) {
    setEvent(value);
    setResult(getResult(value));
  }

  async function handleSubmit(
    e: FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    try {
      setSaving(true);
      setError("");

      const response = await fetch("/api/progress", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          applicationId,
          company,
          role,
          event,
          stage: getStage(event),
          result,
          date,
          nextDate,
          note,
          link,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error("保存进展失败，请稍后重试");
      }

      setOpen(false);
      if (onSuccess) {
        await onSuccess();
      } else {
        window.location.reload();
      }
    } catch {
      setError("保存进展失败，请稍后重试。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          variant === "primary"
            ? "w-full whitespace-nowrap rounded-full bg-neutral-900 px-4 py-2.5 text-sm text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200 sm:w-auto sm:py-2"
            : "inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-full border border-neutral-200 bg-white px-3.5 py-2 text-xs text-neutral-600 transition hover:bg-neutral-50 dark:border-neutral-700 dark:bg-[#171719] dark:text-neutral-300 dark:hover:bg-neutral-800"
        }
      >
        + 新增进展
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/30 p-3 backdrop-blur-sm sm:p-4">
          <div className="my-auto max-h-[calc(100dvh-24px)] w-full max-w-xl overflow-y-auto overscroll-contain rounded-[24px] bg-white p-5 shadow-2xl dark:bg-[#171719] sm:max-h-[90vh] sm:rounded-[30px] sm:p-7">
            <div className="mb-5 flex items-start justify-between gap-4 sm:mb-7">
              <div className="min-w-0">
                <p className="text-[10px] font-medium tracking-[0.14em] text-neutral-400 sm:text-xs sm:tracking-[0.16em]">
                  NEW ACTIVITY
                </p>

                <h2 className="mt-1 text-xl font-semibold sm:text-2xl">
                  新增进展
                </h2>

                <p className="mt-2 break-words text-sm leading-5 text-neutral-400">
                  {company} · {role}
                </p>
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
                  发生了什么？
                </label>

                <select
                  value={event}
                  onChange={(e) =>
                    handleEventChange(e.target.value)
                  }
                    className="w-full min-w-0 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-base outline-none transition focus:border-neutral-400 dark:border-neutral-700 dark:bg-[#111113] dark:focus:border-neutral-500 sm:text-sm"
                  >
                  {eventOptions.map((item) => (
                    <option
                      key={item}
                      value={item}
                    >
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <label className="mb-2 block text-sm font-medium">
                    事件日期
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

                <div className="min-w-0">
                  <label className="mb-2 block text-sm font-medium">
                    结果
                  </label>

                  <select
                    value={result}
                    onChange={(e) =>
                      setResult(e.target.value)
                    }
                  className="w-full min-w-0 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-base outline-none transition focus:border-neutral-400 dark:border-neutral-700 dark:bg-[#111113] dark:focus:border-neutral-500 sm:text-sm"
                >
                    <option>流程中</option>
                    <option>待定</option>
                    <option>通过</option>
                    <option>淘汰</option>
                    <option>主动放弃</option>
                    <option>Offer</option>
                    <option>流程终止</option>
                    <option>无结果</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  下一步日期
                </label>

                <input
                  type="date"
                  value={nextDate}
                  onChange={(e) =>
                    setNextDate(e.target.value)
                  }
                  className="w-full min-w-0 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-base outline-none transition focus:border-neutral-400 dark:border-neutral-700 dark:bg-[#111113] dark:focus:border-neutral-500 sm:text-sm"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  备注
                </label>

                <textarea
                  rows={3}
                  value={note}
                  onChange={(e) =>
                    setNote(e.target.value)
                  }
                  placeholder="例如：面试时间、题目、HR信息..."
                  className="w-full min-w-0 resize-none rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-base outline-none transition focus:border-neutral-400 dark:border-neutral-700 dark:bg-[#111113] dark:focus:border-neutral-500 sm:text-sm"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  相关链接
                </label>

                <input
                  value={link}
                  onChange={(e) =>
                    setLink(e.target.value)
                  }
                  placeholder="https://..."
                  inputMode="url"
                  className="w-full min-w-0 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-base outline-none transition focus:border-neutral-400 dark:border-neutral-700 dark:bg-[#111113] dark:focus:border-neutral-500 sm:text-sm"
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
                    ? "保存中..."
                    : "保存进展"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
