"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AddProgressModal from "./AddProgressModal";

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
  allProgress: ProgressEvent[];
  applicationDate: string | null;
  application?: {
    id: string;
    company: string;
    role: string;
  };
  onProgressCreated?: () => void | Promise<void>;
};

const steps = [
  "投递",
  "测评",
  "笔试",
  "AI面",
  "面试",
  "HR",
  "Offer",
];
const interviewSteps = [
  "一面",
  "二面",
  "三面",
];

export default function ExpandableProcess({
  item,
  allProgress,
  applicationDate,
  application,
  onProgressCreated,
}: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const applicationId = application?.id ?? item.applicationIds?.[0];
  const company = application?.company ?? item.company;
  const role = application?.role ?? item.role;

  const relatedEvents = allProgress.filter(
    (event) =>
      applicationId &&
      event.applicationIds?.includes(applicationId)
  );

  const interviewEvents = relatedEvents
  .filter(
    (event) =>
      event.stage === "面试" &&
      interviewSteps.some((step) =>
        event.event.includes(step)
      )
  )
  .sort((a, b) => {
    if (!a.date) return 1;
    if (!b.date) return -1;

    return b.date.localeCompare(a.date);
  });

const latestInterviewEvent =
  interviewEvents[0];

const furthestInterviewIndex = Math.max(
  -1,
  ...interviewEvents.map((event) =>
    interviewSteps.findIndex((step) =>
      event.event.includes(step)
    )
  )
);

function getInterviewDate(step: string) {
  const match = interviewEvents.find(
    (event) =>
      event.event.includes(step) &&
      event.date
  );

  if (!match?.date) return "";

  return match.date
    .slice(5)
    .replace("-", ".");
}

 function getStepDate(step: string) {
  // 投递日期固定读取第一张「简历投递」
  if (step === "投递" && applicationDate) {
    return applicationDate
      .slice(5)
      .replace("-", ".");
  }

  // 其他阶段读取第二张「求职进度记录」
  const matching = relatedEvents
    .filter(
      (event) =>
        event.stage === step &&
        event.date
    )
    .sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;

      return b.date.localeCompare(a.date);
    });

  const date = matching[0]?.date;

  if (!date) return "";

  return date
    .slice(5)
    .replace("-", ".");
}
// 这个岗位真正经历过哪些阶段
const experiencedStages = new Set(
  relatedEvents
    .map((event) => event.stage)
    .filter(Boolean)
);

// 只要第一张表有投递日期，就认为“投递”真实发生过
if (applicationDate) {
  experiencedStages.add("投递");
}
  
const furthestExperiencedIndex = Math.max(
  0,
  ...Array.from(experiencedStages)
    .map((stage) => steps.indexOf(stage))
    .filter((index) => index >= 0)
);

  const currentStage = item.stage || "投递";

  const currentIndex = Math.max(
    steps.indexOf(currentStage),
    0
  );

  const isFailed =
    item.event === "淘汰" ||
    item.result === "淘汰" ||
    item.result === "主动放弃" ||
    item.result === "流程终止";

  function formatDate(date: string | null) {
    if (!date) return "—";

    return date.slice(5).replace("-", ".");
  }

  return (
    <div className="border-t border-neutral-100 first:border-t-0 dark:border-neutral-800">
      {/* 点击区域 */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full py-5 text-left"
      >
        <div className="flex gap-4">
          <div className="w-12 shrink-0 text-xs font-medium text-neutral-400">
            {formatDate(item.date)}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">
                  {item.company || "未填写公司"}
                </p>

                <p className="mt-1 truncate text-sm text-neutral-400">
                  {item.role || "未填写岗位"}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-full bg-[#eee9ff] px-3 py-1 text-xs text-[#6554c0] dark:bg-violet-950 dark:text-violet-300">
                  {item.event || "未设置"}
                </span>

                <span
                  className={`text-sm text-neutral-400 transition ${
                    open ? "rotate-180" : ""
                  }`}
                >
                  ↓
                </span>
              </div>
            </div>

            <p className="mt-3 text-xs text-neutral-400">
              阶段 · {item.stage || "—"}
              {item.result && ` · ${item.result}`}
            </p>
          </div>
        </div>
      </button>

      {/* 展开流程 */}
      {open && (
        <div className="mb-4 ml-0 rounded-2xl bg-[#f7f7f5] px-3.5 py-4 dark:bg-[#222224] sm:mb-5 sm:ml-8 sm:px-5 sm:py-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium tracking-[0.14em] text-neutral-400">
                APPLICATION PROCESS
              </p>

              <p className="mt-1 text-sm font-medium">
                当前 · {item.event}
              </p>
            </div>

            <span className="text-xs text-neutral-400">
              {relatedEvents.length} 条进展
            </span>
          </div>
{/* 紧凑流程条 */}
<div className="relative mt-5 px-0 sm:mt-6 sm:px-1">
  {/* 灰色底线 */}
  <div className="absolute left-[7%] right-[7%] top-[13px] h-[2px] bg-neutral-200 dark:bg-neutral-800" />

  {/* 已完成蓝色线 */}
  <div
    className="absolute left-[7%] top-[13px] h-[2px] bg-[#1976ff] transition-all"
    style={{
      width:
        currentIndex === 0
          ? "0%"
          : `${(currentIndex / (steps.length - 1)) * 86}%`,
    }}
  />

  <div className="relative grid grid-cols-7">
    {steps.map((step, index) => {
      const current = index === currentIndex;

// 只有数据库里真的发生过，才显示为完成
const completed =
  experiencedStages.has(step) &&
  !current;

const skipped =
  !experiencedStages.has(step) &&
  index < furthestExperiencedIndex;

const failed =
  current && isFailed;

      return (
        <div
          key={step}
          className="flex min-w-0 flex-col items-center"
        >
          <div
            className={`z-10 flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full border-2 text-[11px] font-semibold ${
              completed
                ? "border-[#1976ff] bg-[#e8f1ff] text-[#1976ff]"
                : failed
                ? "border-red-500 bg-red-500 text-white"
                : current
                ? "border-[#1976ff] bg-[#1976ff] text-white"
                : "border-neutral-200 bg-white text-neutral-400 dark:border-neutral-700 dark:bg-[#171719] dark:text-neutral-500"
            }`}
          >
            {completed
              ? "✓"
              : failed
              ? "×"
              : current
              ? index + 1
              : ""}
          </div>

          <div className="mt-2 text-center">
  <p
    className={`whitespace-nowrap text-[9px] sm:text-[10px] ${
      current
        ? "font-semibold text-neutral-900"
        : completed
        ? "font-medium text-neutral-500"
        : "text-neutral-400"
    }`}
  >
    {step}
  </p>

  {getStepDate(step) && (
    <p
      className={`mt-1 text-[8px] sm:text-[9px] ${
        current
          ? "font-medium text-[#1976ff]"
          : "text-neutral-400"
      }`}
    >
      {getStepDate(step)}
    </p>
  )}
</div>
        </div>
      );
    })}
  </div>
</div>

{/* 面试子流程 */}
{(
  currentIndex >= steps.indexOf("面试") ||
  interviewEvents.length > 0
) && (
  <div className="mt-4 rounded-2xl border border-neutral-200 bg-white px-3 py-3.5 dark:border-neutral-700 dark:bg-[#171719] sm:mt-5 sm:px-4 sm:py-4">
    <div className="mb-4 flex items-center justify-between">
      <p className="text-xs font-medium text-neutral-500">
        面试流程
      </p>

      <span className="text-[9px] sm:text-[10px] text-neutral-400">
        INTERVIEW
      </span>
    </div>

    <div className="relative ml-2">
      <div className="absolute bottom-4 left-[11px] top-3 w-[2px] bg-neutral-200 dark:bg-neutral-800" />

      <div className="space-y-5">
        {interviewSteps.map((step, index) => {
          const received =
            interviewEvents.some((event) =>
              event.event.includes(step)
            );

          const completed =
            interviewEvents.some(
              (event) =>
                event.event === `完成${step}`
            );

          const active =
            latestInterviewEvent?.event ===
            `收到${step}`;

          const skipped =
            index < furthestInterviewIndex &&
            !received;

          return (
            <div
              key={step}
              className="relative flex items-center gap-4"
            >
              <div
                className={`z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[9px] sm:text-[10px]] ${
                  completed
                    ? "border-[#1976ff] bg-[#e8f1ff] text-[#1976ff]"
                    : active
                    ? "border-[#1976ff] bg-[#1976ff] text-white"
                    : skipped
                    ? "border-neutral-200 bg-neutral-100 text-neutral-300 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-600"
                    : "border-neutral-200 bg-white text-neutral-300 dark:border-neutral-700 dark:bg-[#171719] dark:text-neutral-600"
                }`}
              >
                {completed
                  ? "✓"
                  : active
                  ? "●"
                  : ""}
              </div>

              <div className="flex min-w-0 flex-1 items-center justify-between">
                <p
                  className={`text-sm ${
                    active
                      ? "font-semibold text-neutral-900"
                      : completed
                      ? "font-medium text-neutral-600"
                      : "text-neutral-400"
                  }`}
                >
                  {step}
                </p>

                {getInterviewDate(step) && (
                  <span className="text-xs text-neutral-400">
                    {getInterviewDate(step)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  </div>
)}

          {/* 底部 */}
          <div className="mt-4 flex flex-col gap-3 border-t border-neutral-200 pt-4 dark:border-neutral-700 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-neutral-500">
              {isFailed ? (
                <span className="text-red-500">
                  流程已结束 · {item.result}
                </span>
              ) : (
                <>
                  当前阶段：
                  <span className="ml-1 font-medium text-neutral-800">
                    {item.stage || "投递"}
                  </span>
                </>
              )}
            </div>

            <div className="flex flex-wrap gap-2 sm:justify-end">
              {applicationId && (
                <AddProgressModal
                  applicationId={applicationId}
                  company={company}
                  role={role}
                  variant="secondary"
                  onSuccess={onProgressCreated}
                />
              )}

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();

                  if (applicationId) {
                    router.push(
                      `/application/${applicationId}`
                    );
                  }
                }}
                className="min-h-11 rounded-full border border-neutral-200 bg-white px-4 py-2 text-xs transition hover:bg-neutral-100 dark:border-neutral-700 dark:bg-[#171719] dark:hover:bg-neutral-800"
              >
                查看完整详情 →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
