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
  progress: ProgressEvent[];
  applicationDate: string | null;
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

export default function ProcessOverview({
  progress,
  applicationDate,
}: Props) {
  const sortedProgress = [...progress].sort((a, b) => {
    if (!a.date) return 1;
    if (!b.date) return -1;

    return b.date.localeCompare(a.date);
  });

  const latest = sortedProgress[0];

  const currentStage =
    latest?.stage || "投递";

  const currentIndex = Math.max(
    steps.indexOf(currentStage),
    0
  );

  const experiencedStages = new Set(
    progress
      .map((event) => event.stage)
      .filter(Boolean)
  );

  if (applicationDate) {
    experiencedStages.add("投递");
  }
const furthestExperiencedIndex = Math.max(
  0,
  ...Array.from(experiencedStages)
    .map((stage) => steps.indexOf(stage))
    .filter((index) => index >= 0)
);
  const isFailed =
    latest?.event === "淘汰" ||
    latest?.result === "淘汰" ||
    latest?.result === "主动放弃" ||
    latest?.result === "流程终止";

  function formatDate(date: string | null) {
    if (!date) return "";

    return date
      .slice(5)
      .replace("-", ".");
  }

  function getStepDate(step: string) {
    if (step === "投递") {
      return formatDate(applicationDate);
    }

    const matching = progress
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

    return formatDate(
      matching[0]?.date ?? null
    );
  }

  const interviewEvents = progress
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

  const latestInterview =
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
    const matching = interviewEvents
      .filter(
        (event) =>
          event.event.includes(step) &&
          event.date
      )
      .sort((a, b) => {
        if (!a.date) return 1;
        if (!b.date) return -1;

        return b.date.localeCompare(a.date);
      });

    return formatDate(
      matching[0]?.date ?? null
    );
  }

  return (
    <section className="mb-6 min-w-0 overflow-hidden rounded-[22px] border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-[#171719] sm:mb-8 sm:rounded-[30px] sm:p-7">
      <div className="mb-6 flex min-w-0 flex-col gap-4 sm:mb-7 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-medium tracking-[0.14em] text-neutral-400 sm:text-xs sm:tracking-[0.16em]">
            APPLICATION PROCESS
          </p>

          <h2 className="mt-1 text-xl font-semibold sm:text-2xl">
            流程进度
          </h2>
        </div>

        <div className="min-w-0 sm:max-w-[45%] sm:text-right">
          <p className="text-xs text-neutral-400">
            当前阶段
          </p>

          <p className="mt-1 break-words text-sm font-medium sm:text-base">
            {latest?.event || "已投递"}
          </p>
        </div>
      </div>

      {/* 主流程：手机端仍然保留 7 个阶段横向完整显示 */}
      <div className="relative min-w-0 px-0 sm:px-2">
        <div className="absolute left-[7%] right-[7%] top-[11px] h-[2px] bg-neutral-200 dark:bg-neutral-800 sm:top-[14px]" />

        <div className="relative grid min-w-0 grid-cols-7">
          {steps.map((step, index) => {
            const current =
              index === currentIndex;

            const completed =
  experiencedStages.has(step) &&
  !current;

const skipped =
  !experiencedStages.has(step) &&
  index < furthestExperiencedIndex;

            const failed =
              current && isFailed;

            const date =
              getStepDate(step);

            return (
              <div
                key={step}
                className="flex min-w-0 flex-col items-center"
              >
                <div
                  className={`z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[9px] font-semibold sm:h-8 sm:w-8 sm:text-[11px] ${
                    completed
                      ? "border-[#1976ff] bg-[#e8f1ff] text-[#1976ff]"
                      : failed
                      ? "border-red-500 bg-red-500 text-white"
                      : current
                      ? "border-[#1976ff] bg-[#1976ff] text-white"
                      : skipped
                      ? "border-neutral-200 bg-neutral-100 text-neutral-300 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-600"
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

                <p
                  className={`mt-1.5 whitespace-nowrap text-[9px] sm:mt-2 sm:text-xs ${
                    current
                      ? "font-semibold text-neutral-900"
                      : completed
                      ? "font-medium text-neutral-600"
                      : "text-neutral-400"
                  }`}
                >
                  {step}
                </p>

                {date && (
                  <p
                    className={`mt-1 whitespace-nowrap text-[8px] sm:text-[10px] ${
                      current
                        ? "font-medium text-[#1976ff]"
                        : "text-neutral-400"
                    }`}
                  >
                    {date}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 面试分支 */}
      {interviewEvents.length > 0 && (
        <div className="mt-6 min-w-0 rounded-2xl bg-[#f7f7f5] p-4 dark:bg-[#222224] sm:mt-8 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3 sm:mb-5">
            <p className="text-sm font-medium">
              面试轮次
            </p>

            <span className="shrink-0 text-[9px] tracking-[0.1em] text-neutral-400 sm:text-[10px] sm:tracking-[0.12em]">
              INTERVIEW
            </span>
          </div>

          <div className="relative ml-0.5 sm:ml-1">
            <div className="absolute bottom-3 left-[9px] top-3 w-[2px] bg-neutral-200 dark:bg-neutral-800 sm:left-[10px]" />

            <div className="space-y-4 sm:space-y-5">
              {interviewSteps.map(
                (step, index) => {
                  const received =
                    interviewEvents.some(
                      (event) =>
                        event.event.includes(
                          step
                        )
                    );

                  const completed =
                    interviewEvents.some(
                      (event) =>
                        event.event ===
                        `完成${step}`
                    );

                  const active =
                    latestInterview?.event ===
                    `收到${step}`;

                  const skipped =
                    index <
                      furthestInterviewIndex &&
                    !received;

                  const interviewDate =
                    getInterviewDate(step);

                  return (
                    <div
                      key={step}
                      className="relative flex min-w-0 items-center gap-3 sm:gap-4"
                    >
                      <div
                        className={`z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[9px] ${
                          completed
                            ? "border-[#1976ff] bg-[#e8f1ff] text-[#1976ff]"
                            : active
                            ? "border-[#1976ff] bg-[#1976ff] text-white"
                            : skipped
                            ? "border-neutral-200 bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800"
                            : "border-neutral-200 bg-white dark:border-neutral-700 dark:bg-[#171719]"
                        }`}
                      >
                        {completed
                          ? "✓"
                          : active
                          ? "•"
                          : ""}
                      </div>

                      <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                        <p
                          className={`min-w-0 text-sm ${
                            active
                              ? "font-semibold text-neutral-900"
                              : completed
                              ? "font-medium text-neutral-600"
                              : "text-neutral-400"
                          }`}
                        >
                          {step}
                        </p>

                        {interviewDate && (
                          <span className="shrink-0 text-xs text-neutral-400">
                            {interviewDate}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </div>
        </div>
      )}

      {isFailed && (
        <div className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-500 dark:bg-red-950/50 dark:text-red-300 sm:mt-6">
          流程已结束 ·{" "}
          {latest?.result || "淘汰"}
        </div>
      )}
    </section>
  );
}
