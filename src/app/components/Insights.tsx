type Application = {
  id: string;
  status: string;
  date: string | null;
};

type ProgressEvent = {
  applicationIds: string[];
  stage: string;
  event: string;
  result: string;
  date: string | null;
};

type Props = {
  applications: Application[];
  progress: ProgressEvent[];
  loading: boolean;
};

const statusOrder = [
  "面试中",
  "笔试中",
  "测评中",
  "已投递",
  "已笔试",
  "已测评",
  "已挂",
  "收到offer",
  "未投递",
];

const statusColors: Record<string, string> = {
  面试中: "bg-[#78879a] dark:bg-[#91a0b4]",
  笔试中: "bg-[#a28b76] dark:bg-[#b69f8b]",
  测评中: "bg-[#93869d] dark:bg-[#aa9fba]",
  已投递: "bg-[#87909a] dark:bg-[#9da6af]",
  已笔试: "bg-[#a99a7b] dark:bg-[#bdb08f]",
  已测评: "bg-[#9d8ca1] dark:bg-[#b4a2b9]",
  已挂: "bg-[#a17f80] dark:bg-[#b99697]",
  收到offer: "bg-[#799889] dark:bg-[#90ad9f]",
  未投递: "bg-[#a6aaab] dark:bg-[#888d8f]",
};

function isTerminal(status: string, latest?: ProgressEvent) {
  return (
    status === "已挂" ||
    latest?.result === "淘汰" ||
    latest?.result === "主动放弃" ||
    latest?.result === "流程终止"
  );
}

function hasOffer(status: string, latest?: ProgressEvent) {
  return (
    status === "收到offer" ||
    latest?.event === "收到Offer" ||
    latest?.result === "Offer"
  );
}

function getWeekStart(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  const day = parsed.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  parsed.setDate(parsed.getDate() + mondayOffset);

  return parsed.toISOString().slice(0, 10);
}

function formatWeekLabel(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  return `${parsed.getMonth() + 1}/${parsed.getDate()}`;
}

export default function Insights({ applications, progress, loading }: Props) {
  const sortedProgress = [...progress].sort((a, b) => {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return b.date.localeCompare(a.date);
  });

  const latestByApplication = new Map<string, ProgressEvent>();
  const stagesByApplication = new Map<string, Set<string>>();

  sortedProgress.forEach((item) => {
    item.applicationIds.forEach((applicationId) => {
      if (!latestByApplication.has(applicationId)) {
        latestByApplication.set(applicationId, item);
      }

      const stages = stagesByApplication.get(applicationId) || new Set();
      if (item.stage) stages.add(item.stage);
      stagesByApplication.set(applicationId, stages);
    });
  });

  const funnel = applications.reduce(
    (counts, application) => {
      const latest = latestByApplication.get(application.id);
      const stages = stagesByApplication.get(application.id) || new Set();
      const ended = isTerminal(application.status, latest);
      const offer = hasOffer(application.status, latest);
      const inPipeline = application.status !== "未投递" && (!ended || offer);
      const interviewStage =
        stages.has("AI面") ||
        stages.has("面试") ||
        stages.has("HR") ||
        application.status === "面试中" ||
        offer;

      return {
        total: counts.total + 1,
        pipeline: counts.pipeline + Number(inPipeline),
        interview: counts.interview + Number(interviewStage),
        offer: counts.offer + Number(offer),
      };
    },
    { total: 0, pipeline: 0, interview: 0, offer: 0 }
  );

  const statusCounts = applications.reduce<Record<string, number>>(
    (counts, application) => {
      const status = application.status || "未投递";
      counts[status] = (counts[status] || 0) + 1;
      return counts;
    },
    {}
  );

  const distribution = statusOrder
    .filter((status) => statusCounts[status])
    .map((status) => ({ status, count: statusCounts[status] }))
    .sort((first, second) => second.count - first.count)
    .slice(0, 6);

  const weeklyCounts = applications
    .filter((application) => application.date)
    .reduce<Record<string, number>>((counts, application) => {
      const week = getWeekStart(application.date as string);
      counts[week] = (counts[week] || 0) + 1;
      return counts;
    }, {});

  const weeklyTrend = Object.entries(weeklyCounts)
    .sort(([first], [second]) => first.localeCompare(second))
    .slice(-8)
    .map(([week, count]) => ({ week, count }));

  const highestWeek = Math.max(...weeklyTrend.map((item) => item.count), 1);
  const funnelItems = [
    { label: "总投递", value: funnel.total, tone: "bg-[#3d4145] dark:bg-[#d7dbdd]" },
    { label: "仍在流程", value: funnel.pipeline, tone: "bg-[#8290a1] dark:bg-[#9ba8b8]" },
    { label: "进入面试", value: funnel.interview, tone: "bg-[#978aa0] dark:bg-[#afa1b8]" },
    { label: "收到 Offer", value: funnel.offer, tone: "bg-[#7e9a8a] dark:bg-[#98b09f]" },
  ];

  return (
    <section className="mt-6 sm:mt-8">
      <div className="mb-4 flex items-end justify-between gap-4 sm:mb-5">
        <div>
          <p className="text-xs font-medium tracking-[0.16em] text-neutral-400">INSIGHTS</p>
          <h2 className="mt-1 text-xl font-semibold sm:text-2xl">求职洞察</h2>
        </div>
        <p className="text-right text-xs leading-5 text-neutral-400">基于现有投递和进展记录</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[22px] border border-neutral-200 bg-white p-4 sm:rounded-[28px] sm:p-6 dark:border-neutral-800 dark:bg-[#171719]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium tracking-[0.14em] text-neutral-400">FUNNEL</p>
              <h3 className="mt-1 text-lg font-semibold">求职流程漏斗</h3>
            </div>
            <span className="rounded-full bg-[#f5f5f3] px-3 py-1 text-xs text-neutral-500 dark:bg-neutral-800 dark:text-neutral-300">实时计算</span>
          </div>

          <div className="mt-6 space-y-3.5">
            {funnelItems.map((item, index) => {
              const ratio = funnel.total
                ? Math.max((item.value / funnel.total) * 100, item.value ? 8 : 0)
                : 0;

              return (
                <div key={item.label}>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-neutral-500 dark:text-neutral-300">{item.label}</span>
                    <span className="font-semibold">{loading ? "—" : item.value}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#eef0ef] dark:bg-neutral-800">
                    <div className={`h-full rounded-full transition-all ${item.tone}`} style={{ width: loading ? "18%" : `${ratio}%` }} />
                  </div>
                  {index > 0 && !loading && funnel.total > 0 && (
                    <p className="mt-1.5 text-right text-xs text-neutral-400">{Math.round((item.value / funnel.total) * 100)}% / 总投递</p>
                  )}
                </div>
              );
            })}
          </div>

          <p className="mt-5 text-xs leading-5 text-neutral-400">以实际流程记录为准；跳过测评或笔试的公司不会被强行归类。</p>
        </section>

        <section className="rounded-[22px] border border-neutral-200 bg-white p-4 sm:rounded-[28px] sm:p-6 dark:border-neutral-800 dark:bg-[#171719]">
          <p className="text-xs font-medium tracking-[0.14em] text-neutral-400">STATUS MIX</p>
          <h3 className="mt-1 text-lg font-semibold">当前状态分布</h3>

          <div className="mt-6 space-y-3.5">
            {loading ? (
              <div className="space-y-4">
                {[0, 1, 2, 3].map((item) => <div key={item} className="h-9 animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-800" />)}
              </div>
            ) : distribution.length === 0 ? (
              <p className="py-10 text-center text-sm text-neutral-400">暂无可视化数据</p>
            ) : (
              distribution.map((item) => {
                const ratio = applications.length ? (item.count / applications.length) * 100 : 0;
                return (
                  <div key={item.status}>
                    <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                      <span className="flex min-w-0 items-center gap-2 text-neutral-600 dark:text-neutral-300">
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${statusColors[item.status] || "bg-neutral-400"}`} />
                        <span className="truncate">{item.status === "收到offer" ? "收到 Offer" : item.status}</span>
                      </span>
                      <span className="shrink-0 font-semibold">{item.count}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[#eef0ef] dark:bg-neutral-800">
                      <div className={`h-full rounded-full ${statusColors[item.status] || "bg-neutral-400"}`} style={{ width: `${Math.max(ratio, 5)}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      <section className="mt-4 rounded-[22px] border border-neutral-200 bg-white p-4 sm:rounded-[28px] sm:p-6 dark:border-neutral-800 dark:bg-[#171719]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium tracking-[0.14em] text-neutral-400">APPLICATION RHYTHM</p>
            <h3 className="mt-1 text-lg font-semibold">每周投递趋势</h3>
          </div>
          {!loading && weeklyTrend.length > 0 && (
            <span className="text-right text-xs leading-5 text-neutral-400">最近 {weeklyTrend.length} 周<br />峰值 {highestWeek} 个岗位</span>
          )}
        </div>

        {loading ? (
          <div className="mt-5 grid h-28 grid-cols-8 items-end gap-2 px-1 sm:h-32 sm:gap-3 lg:h-28 lg:px-4">
            {[36, 62, 48, 84, 56, 70, 42, 66].map((height, index) => <div key={index} className="animate-pulse rounded-t-xl bg-neutral-100 dark:bg-neutral-800" style={{ height: `${height}%` }} />)}
          </div>
        ) : weeklyTrend.length === 0 ? (
          <p className="py-14 text-center text-sm text-neutral-400">填写投递日期后，这里会显示每周节奏。</p>
        ) : (
          <div className="mt-5 grid h-32 grid-cols-8 items-end gap-2 px-1 sm:h-36 sm:gap-3 lg:h-28 lg:px-4">
            {weeklyTrend.map((item) => (
              <div key={item.week} className="flex h-full min-w-0 flex-col justify-end">
                <div className="group relative flex flex-1 items-end">
                  <div className="w-full rounded-t-lg bg-[#8794a4] transition-colors group-hover:bg-[#707d8c] dark:bg-[#9ba8b8] dark:group-hover:bg-[#b5bfca]" style={{ height: `${Math.max((item.count / highestWeek) * 100, 8)}%` }} aria-label={`${formatWeekLabel(item.week)} 当周投递 ${item.count} 个岗位`} />
                  <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 rounded-full bg-[#3d4145] px-2 py-1 text-[10px] text-white opacity-0 transition group-hover:opacity-100 dark:bg-[#d7dbdd] dark:text-neutral-900">{item.count}</span>
                </div>
                <p className="mt-2 truncate text-center text-[10px] text-neutral-400 sm:text-xs">{formatWeekLabel(item.week)}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
