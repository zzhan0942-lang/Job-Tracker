import { useMemo } from "react";

type Application = {
  id: string;
  status: string;
};

type ProgressEvent = {
  applicationIds: string[];
  stage: string;
  event: string;
  result: string;
};

type Props = {
  applications: Application[];
  progress: ProgressEvent[];
};

type Conversion = {
  label: string;
  from: number;
  to: number;
  rate: number | null;
};

const conversionDefinitions = [
  {
    label: "投递 → 测评/笔试",
    from: (stages: Set<string>) => stages.has("投递"),
    to: (stages: Set<string>) => stages.has("测评") || stages.has("笔试"),
  },
  {
    label: "测评/笔试 → AI面/正式面试",
    from: (stages: Set<string>) => stages.has("测评") || stages.has("笔试"),
    to: (stages: Set<string>) => stages.has("AI面") || stages.has("面试"),
  },
  {
    label: "AI面 → 正式面试",
    from: (stages: Set<string>) => stages.has("AI面"),
    to: (stages: Set<string>) => stages.has("面试"),
  },
  {
    label: "面试 → HR",
    from: (stages: Set<string>) => stages.has("面试"),
    to: (stages: Set<string>) => stages.has("HR"),
  },
  {
    label: "HR → Offer",
    from: (stages: Set<string>) => stages.has("HR"),
    to: (stages: Set<string>) => stages.has("Offer"),
  },
];

export default function ConversionInsights({ applications, progress }: Props) {
  const conversions = useMemo<Conversion[]>(() => {
    const stagesByApplication = new Map<string, Set<string>>();

    applications.forEach((application) => {
      const stages = new Set<string>(["投递"]);

      if (application.status === "收到offer") {
        stages.add("Offer");
      }

      stagesByApplication.set(application.id, stages);
    });

    progress.forEach((item) => {
      item.applicationIds.forEach((applicationId) => {
        const stages = stagesByApplication.get(applicationId);

        if (!stages) return;

        if (item.stage) stages.add(item.stage);

        if (
          item.stage === "Offer" ||
          item.event === "收到Offer" ||
          item.result === "Offer"
        ) {
          stages.add("Offer");
        }
      });
    });

    const stageSets = Array.from(stagesByApplication.values());

    return conversionDefinitions.map(({ label, from, to }) => {
      const eligible = stageSets.filter(from);
      const completed = eligible.filter(to).length;
      const rate = eligible.length ? (completed / eligible.length) * 100 : null;

      return { label, from: eligible.length, to: completed, rate };
    });
  }, [applications, progress]);

  const weakestConversion = conversions
    .filter((item) => item.rate !== null)
    .reduce<Conversion | null>(
      (weakest, item) =>
        !weakest || (item.rate as number) < (weakest.rate as number)
          ? item
          : weakest,
      null
    );

  return (
    <section className="mt-6 min-w-0 rounded-[22px] border border-neutral-200 bg-white p-4 sm:mt-8 sm:rounded-[28px] sm:p-6 dark:border-neutral-800 dark:bg-[#171719]">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-[0.16em] text-neutral-400">
            INSIGHTS
          </p>
          <h2 className="mt-1 text-xl font-semibold sm:text-2xl">流程转化率</h2>
        </div>
        <p className="text-xs leading-5 text-neutral-400">
          按岗位实际经历的阶段计算
        </p>
      </div>

      <div className="mt-5 grid gap-3 sm:mt-6 sm:grid-cols-2 xl:grid-cols-3">
        {conversions.map((item) => {
          const percentage = item.rate === null ? "—" : `${Math.round(item.rate)}%`;

          return (
            <article
              key={item.label}
              className="min-w-0 rounded-2xl bg-[#f7f7f5] p-4 dark:bg-[#222224]"
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <p className="min-w-0 text-sm font-medium leading-5 text-neutral-700 dark:text-neutral-200">
                  {item.label}
                </p>
                <span className="shrink-0 text-base font-semibold tracking-tight">
                  {percentage}
                </span>
              </div>

              <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
                {item.to} / {item.from} · {percentage}
              </p>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
                <div
                  className="h-full rounded-full bg-[#78879a] transition-[width] dark:bg-[#a6b1c0]"
                  style={{ width: `${item.rate ?? 0}%` }}
                />
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-5 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm dark:border-neutral-700 dark:bg-[#171719]">
        <span className="text-neutral-400">当前最大流失环节</span>
        <p className="mt-1 font-medium">
          {weakestConversion
            ? `${weakestConversion.label} · ${Math.round(weakestConversion.rate as number)}%`
            : "暂无足够的阶段样本"}
        </p>
      </div>
    </section>
  );
}
