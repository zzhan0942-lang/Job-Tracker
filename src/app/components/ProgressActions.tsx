"use client";

import { useState } from "react";

type ProgressEvent = {
  id: string;
  applicationIds: string[];
  title: string;
  company: string;
  role: string;
  base: string;
  event: string;
  stage: string;
  result: string;
  date: string | null;
  nextDate: string | null;
  note: string;
  link: string | null;
};

type Props = {
  item: ProgressEvent;
  isLatest: boolean;
  previousItem?: ProgressEvent;
};

const events = [
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

const stages = [
  "投递",
  "测评",
  "笔试",
  "AI面",
  "面试",
  "HR",
  "Offer",
];

const results = [
  "流程中",
  "待定",
  "通过",
  "淘汰",
  "主动放弃",
  "Offer",
  "流程终止",
  "无结果",
];

function getStatus(item?: ProgressEvent) {
  if (!item) return "已投递";

  if (
    item.event === "淘汰" ||
    item.result === "淘汰" ||
    item.result === "主动放弃" ||
    item.result === "流程终止"
  ) {
    return "已挂";
  }

  if (
    item.event === "收到Offer" ||
    item.result === "Offer"
  ) {
    return "收到offer";
  }

  if (item.stage === "测评") {
    return item.event.includes("完成")
      ? "已测评"
      : "测评中";
  }

  if (item.stage === "笔试") {
    return item.event.includes("完成")
      ? "已笔试"
      : "笔试中";
  }

  if (
    ["AI面", "面试", "HR"].includes(item.stage)
  ) {
    return "面试中";
  }

  return "已投递";
}

export default function ProgressActions({
  item,
  isLatest,
  previousItem,
}: Props) {
  const [open, setOpen] = useState(false);

  const [event, setEvent] = useState(item.event);
  const [stage, setStage] = useState(item.stage);
  const [result, setResult] = useState(item.result);
  const [date, setDate] = useState(item.date || "");
  const [nextDate, setNextDate] =
    useState(item.nextDate || "");
  const [note, setNote] = useState(item.note || "");
  const [link, setLink] = useState(item.link || "");

  const [saving, setSaving] = useState(false);

  async function save() {
    try {
      setSaving(true);

      const response = await fetch("/api/progress", {
        method: "PATCH",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          id: item.id,
          applicationId:
            item.applicationIds?.[0],
          company: item.company,
          role: item.role,
          event,
          stage,
          result,
          date,
          nextDate,
          note,
          link,
          syncStatus: isLatest,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        alert(data.error || "保存失败");
        return;
      }

      setOpen(false);
      window.location.reload();
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    const confirmed = window.confirm(
      `确定删除「${item.event}」这条进展吗？`
    );

    if (!confirmed) return;

    const response = await fetch("/api/progress", {
      method: "DELETE",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        id: item.id,
        applicationId:
          item.applicationIds?.[0],

        syncStatus: isLatest,

        fallbackStatus:
          getStatus(previousItem),
      }),
    });

    const data = await response.json();

    if (data.success) {
      window.location.reload();
    } else {
      alert(data.error || "删除失败");
    }
  }

  return (
    <>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full border border-neutral-200 px-3.5 py-2 text-xs text-neutral-500 transition hover:bg-neutral-50"
        >
          编辑
        </button>

        <button
          type="button"
          onClick={remove}
          className="rounded-full border border-red-100 px-3.5 py-2 text-xs text-red-400 transition hover:bg-red-50"
        >
          删除
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/30 p-3 backdrop-blur-sm sm:p-4">
          <div className="my-auto max-h-[calc(100dvh-24px)] w-full max-w-xl overflow-y-auto overscroll-contain rounded-[24px] bg-white p-5 shadow-2xl sm:max-h-[90vh] sm:rounded-[30px] sm:p-7">
            <div className="mb-5 flex items-start justify-between gap-4 sm:mb-7">
              <div className="min-w-0">
                <p className="text-[10px] font-medium tracking-[0.14em] text-neutral-400 sm:text-xs sm:tracking-[0.16em]">
                  EDIT ACTIVITY
                </p>

                <h2 className="mt-1 text-xl font-semibold sm:text-2xl">
                  编辑进展
                </h2>

                <p className="mt-2 break-words text-sm leading-5 text-neutral-400">
                  {item.company} · {item.role}
                </p>
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

            <div className="space-y-4 sm:space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  事件类型
                </label>

                <select
                  value={event}
                  onChange={(e) =>
                    setEvent(e.target.value)
                  }
                  className="w-full min-w-0 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-base outline-none transition focus:border-neutral-400 sm:text-sm"
                >
                  {events.map((value) => (
                    <option
                      key={value}
                      value={value}
                    >
                      {value}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <label className="mb-2 block text-sm font-medium">
                    阶段
                  </label>

                  <select
                    value={stage}
                    onChange={(e) =>
                      setStage(e.target.value)
                    }
                    className="w-full min-w-0 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-base outline-none transition focus:border-neutral-400 sm:text-sm"
                  >
                    {stages.map((value) => (
                      <option
                        key={value}
                        value={value}
                      >
                        {value}
                      </option>
                    ))}
                  </select>
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
                    className="w-full min-w-0 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-base outline-none transition focus:border-neutral-400 sm:text-sm"
                  >
                    {results.map((value) => (
                      <option
                        key={value}
                        value={value}
                      >
                        {value}
                      </option>
                    ))}
                  </select>
                </div>
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
                    className="w-full min-w-0 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-base outline-none transition focus:border-neutral-400 sm:text-sm"
                  />
                </div>

                <div className="min-w-0">
                  <label className="mb-2 block text-sm font-medium">
                    下一步日期
                  </label>

                  <input
                    type="date"
                    value={nextDate}
                    onChange={(e) =>
                      setNextDate(e.target.value)
                    }
                    className="w-full min-w-0 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-base outline-none transition focus:border-neutral-400 sm:text-sm"
                  />
                </div>
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
                  placeholder="备注"
                  className="w-full min-w-0 resize-none rounded-2xl border border-neutral-200 px-4 py-3 text-base outline-none transition focus:border-neutral-400 sm:text-sm"
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
                  className="w-full min-w-0 rounded-2xl border border-neutral-200 px-4 py-3 text-base outline-none transition focus:border-neutral-400 sm:text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1 sm:flex sm:justify-end sm:pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="w-full rounded-full border border-neutral-200 px-4 py-2.5 text-sm sm:w-auto sm:px-5"
                >
                  取消
                </button>

                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="w-full rounded-full bg-neutral-900 px-4 py-2.5 text-sm text-white disabled:opacity-50 sm:w-auto sm:px-6"
                >
                  {saving
                    ? "保存中..."
                    : "保存修改"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
