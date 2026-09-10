"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AddApplicationModal from "./components/AddApplicationModal";
import ConversionInsights from "./components/ConversionInsights";
import ExpandableProcess from "./components/ExpandableProcess";
import Insights from "./components/Insights";
import StatusBadge from "./components/StatusBadge";

type Application = {
  id: string;
  company: string;
  role: string;
  title: string;
  status: string;
  base: string;
  date: string | null;
};

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

type ThemeMode = "light" | "dark" | "system";

const themeLabels: Record<ThemeMode, string> = {
  light: "白天",
  dark: "黑夜",
  system: "跟随系统",
};

const PAGE_SIZE = 10;

export default function Home() {
  const router = useRouter();

  const [applications, setApplications] = useState<Application[]>([]);
  const [progress, setProgress] = useState<ProgressEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("全部");
  const [currentPage, setCurrentPage] = useState(1);

  const [progressSearch, setProgressSearch] = useState("");
  const [progressView, setProgressView] = useState<"active" | "all">(
    "active"
  );
  const [progressPage, setProgressPage] = useState(1);

  const [themeMode, setThemeMode] = useState<ThemeMode>("system");
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [themeReady, setThemeReady] = useState(false);

  useEffect(() => {
    const storedMode = window.localStorage.getItem("job-tracker-theme");

    if (storedMode === "light" || storedMode === "dark" || storedMode === "system") {
      setThemeMode(storedMode);
    }

    setThemeReady(true);
  }, []);

  useEffect(() => {
    if (!themeReady) return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const resolvedTheme =
        themeMode === "system"
          ? mediaQuery.matches
            ? "dark"
            : "light"
          : themeMode;

      document.documentElement.dataset.theme = resolvedTheme;
    };

    applyTheme();
    window.localStorage.setItem("job-tracker-theme", themeMode);

    const handleSystemChange = () => {
      if (themeMode === "system") applyTheme();
    };

    mediaQuery.addEventListener("change", handleSystemChange);

    return () => mediaQuery.removeEventListener("change", handleSystemChange);
  }, [themeMode, themeReady]);

  useEffect(() => {
    async function loadData() {
      try {
        const [applicationsResponse, progressResponse] = await Promise.all([
          fetch("/api/applications"),
          fetch("/api/progress"),
        ]);

        const applicationsData = await applicationsResponse.json();
        const progressData = await progressResponse.json();

        if (applicationsData.success) {
          setApplications(applicationsData.applications);
        }

        if (progressData.success) {
          setProgress(progressData.progress);
        }
      } catch (error) {
        console.error("读取 Notion 数据失败：", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const sortedProgress = useMemo(() => {
    return [...progress].sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return b.date.localeCompare(a.date);
    });
  }, [progress]);

  const latestProgressByApplication = useMemo(() => {
    const latestMap = new Map<string, ProgressEvent>();

    sortedProgress.forEach((event) => {
      event.applicationIds.forEach((applicationId) => {
        if (!latestMap.has(applicationId)) {
          latestMap.set(applicationId, event);
        }
      });
    });

    return latestMap;
  }, [sortedProgress]);

  const stats = useMemo(() => {
    let active = 0;
    let tests = 0;
    let interviews = 0;
    let offers = 0;

    applications.forEach((application) => {
      const latest = latestProgressByApplication.get(application.id);

      const isTerminal =
        application.status === "已挂" ||
        latest?.result === "淘汰" ||
        latest?.result === "主动放弃" ||
        latest?.result === "流程终止";

      const hasOffer =
        application.status === "收到offer" ||
        latest?.event === "收到Offer" ||
        latest?.result === "Offer";

      if (hasOffer) {
        offers += 1;
        return;
      }

      if (application.status !== "未投递" && !isTerminal) {
        active += 1;
      }

      if (isTerminal) return;

      if (
        latest?.stage === "测评" ||
        latest?.stage === "笔试" ||
        ["测评中", "已测评", "笔试中", "已笔试"].includes(
          application.status
        )
      ) {
        tests += 1;
      }

      if (
        latest?.stage === "AI面" ||
        latest?.stage === "面试" ||
        latest?.stage === "HR" ||
        application.status === "面试中"
      ) {
        interviews += 1;
      }
    });

    return [
      { label: "总记录", value: applications.length },
      { label: "进行中", value: active },
      { label: "测评 / 笔试", value: tests },
      { label: "面试中", value: interviews },
      { label: "Offer", value: offers },
    ];
  }, [applications, latestProgressByApplication]);

  const filteredApplications = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();

    return [...applications]
      .filter((item) => {
        const matchesSearch =
          !keyword ||
          item.company.toLowerCase().includes(keyword) ||
          item.role.toLowerCase().includes(keyword) ||
          item.base.toLowerCase().includes(keyword);

        const matchesStatus =
          statusFilter === "全部" || item.status === statusFilter;

        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return b.date.localeCompare(a.date);
      });
  }, [applications, searchTerm, statusFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredApplications.length / PAGE_SIZE)
  );

  const paginatedApplications = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;

    return filteredApplications.slice(start, end);
  }, [filteredApplications, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  /*
   * 左侧“最近进展”只读取第二张 Notion 数据库：
   * - 只有“求职进度记录”里存在历史事件的岗位才显示；
   * - 同一个岗位只显示最新一条进展；
   * - “全部”指全部有进展记录的岗位，不包含只有第一张表记录的岗位。
   */
  const latestProgress = useMemo(() => {
    const seen = new Set<string>();
    const result: ProgressEvent[] = [];

    for (const item of sortedProgress) {
      const applicationId = item.applicationIds?.[0];

      if (!applicationId) continue;
      if (seen.has(applicationId)) continue;

      seen.add(applicationId);
      result.push(item);
    }

    return result;
  }, [sortedProgress]);

  const visibleProgress = useMemo(() => {
    const keyword = progressSearch.trim().toLowerCase();

    return latestProgress.filter((item) => {
      const matchesSearch =
        !keyword ||
        item.company.toLowerCase().includes(keyword) ||
        item.role.toLowerCase().includes(keyword);

      if (!matchesSearch) return false;
      if (progressView === "all") return true;

      const applicationId = item.applicationIds?.[0];
      const application = applications.find(
        (candidate) => candidate.id === applicationId
      );

      const isEnded =
        application?.status === "已挂" ||
        application?.status === "收到offer" ||
        item.result === "淘汰" ||
        item.result === "主动放弃" ||
        item.result === "流程终止" ||
        item.result === "Offer";

      return !isEnded;
    });
  }, [applications, latestProgress, progressSearch, progressView]);

  const totalProgressPages = Math.max(
    1,
    Math.ceil(visibleProgress.length / PAGE_SIZE)
  );

  const paginatedProgress = useMemo(() => {
    const start = (progressPage - 1) * PAGE_SIZE;
    return visibleProgress.slice(start, start + PAGE_SIZE);
  }, [progressPage, visibleProgress]);

  useEffect(() => {
    setProgressPage(1);
  }, [progressSearch, progressView]);

  useEffect(() => {
    if (progressPage > totalProgressPages) {
      setProgressPage(totalProgressPages);
    }
  }, [progressPage, totalProgressPages]);

  const upcomingTasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return progress
      .filter((item) => item.nextDate)
      .map((item) => {
        const targetDate = new Date(`${item.nextDate}T00:00:00`);
        targetDate.setHours(0, 0, 0, 0);

        const diffDays = Math.round(
          (targetDate.getTime() - today.getTime()) /
            (1000 * 60 * 60 * 24)
        );

        return {
          ...item,
          diffDays,
        };
      })
      .filter((item) => item.diffDays >= 0)
      .sort((a, b) => a.diffDays - b.diffDays)
      .slice(0, 6);
  }, [progress]);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f5f5f3] text-[#171717] dark:bg-[#101011] dark:text-[#f5f5f5]">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 sm:py-10 lg:px-10">
        <header className="mb-8 flex flex-col gap-5 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="mb-2 text-xs font-medium tracking-[0.18em] text-neutral-400 sm:text-sm">
              JOB SEARCH / 2026
            </p>

            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              求职控制台
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-6 text-neutral-500">
              把每一次投递、测评和面试变成一条清晰的轨迹。
            </p>
          </div>

          <div className="relative w-fit">
            <button
              type="button"
              onClick={() => setThemeMenuOpen((open) => !open)}
              aria-expanded={themeMenuOpen}
              aria-haspopup="menu"
              className="h-11 rounded-full border border-neutral-200 bg-white px-4 text-sm shadow-sm transition hover:bg-neutral-50 sm:h-auto sm:px-4 sm:py-2 sm:text-sm dark:border-neutral-800 dark:bg-[#171719] dark:hover:bg-neutral-800"
            >
              <span className="sm:hidden">{themeLabels[themeMode]} · ▾</span>
              <span className="hidden sm:inline">Sep. 2026 · {themeLabels[themeMode]} · ▾</span>
            </button>

            {themeMenuOpen && (
              <div
                role="menu"
                className="absolute left-0 z-20 mt-2 w-[190px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-neutral-200 bg-white p-1 sm:w-36 sm:p-1.5 shadow-xl dark:border-neutral-700 dark:bg-[#202023]"
              >
                {(Object.keys(themeLabels) as ThemeMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    role="menuitemradio"
                    aria-checked={themeMode === mode}
                    onClick={() => {
                      setThemeMode(mode);
                      setThemeMenuOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-1.5 text-left text-sm transition sm:px-3 sm:py-2 ${
                      themeMode === mode
                        ? "bg-[#f0f2f1] font-medium dark:bg-neutral-700"
                        : "hover:bg-neutral-50 dark:hover:bg-neutral-800"
                    }`}
                  >
                    {themeLabels[mode]}
                    {themeMode === mode && (
                      <span aria-hidden="true" className="text-xs sm:text-sm">
                        ✓
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>

        <section className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-5">
          {stats.map((item, index) => (
            <div
              key={item.label}
              className={`min-w-0 rounded-[22px] p-4 sm:rounded-3xl sm:p-5 ${
                index === 0
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  : "border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-[#171719]"
              }`}
            >
              <p
                className={`text-xs sm:text-sm ${
                  index === 0 ? "text-neutral-400" : "text-neutral-500"
                }`}
              >
                {item.label}
              </p>

              <p className="mt-4 text-3xl font-semibold tracking-tight sm:mt-5 sm:text-4xl">
                {loading ? "—" : item.value}
              </p>
            </div>
          ))}
        </section>

        <section className="mt-5 min-w-0 rounded-[22px] border border-neutral-200 bg-white px-4 py-4 sm:mt-6 sm:rounded-[28px] sm:px-6 sm:py-5 dark:border-neutral-800 dark:bg-[#171719]">
          <div className="mb-4 flex items-start justify-between gap-4 sm:mb-5 sm:items-center">
            <div className="min-w-0">
              <p className="text-xs font-medium tracking-[0.16em] text-neutral-400">
                UPCOMING
              </p>

              <h2 className="mt-1 text-xl font-semibold">待跟进</h2>
            </div>

            <span className="shrink-0 text-sm text-neutral-400">
              {upcomingTasks.length} 项
            </span>
          </div>

          {upcomingTasks.length === 0 ? (
            <div className="py-5 text-sm text-neutral-400">
              暂无即将到期的事项
            </div>
          ) : (
            <div className="grid gap-2.5 sm:gap-3 md:grid-cols-2 xl:grid-cols-3">
              {upcomingTasks.map((item) => {
                let dateLabel = item.nextDate || "";

                if (item.diffDays === 0) {
                  dateLabel = "今天";
                } else if (item.diffDays === 1) {
                  dateLabel = "明天";
                } else if (item.diffDays <= 7) {
                  dateLabel = `${item.diffDays} 天后`;
                }

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      const applicationId = item.applicationIds?.[0];

                      if (applicationId) {
                        router.push(`/application/${applicationId}`);
                      }
                    }}
                    className="flex min-w-0 items-start justify-between gap-3 rounded-2xl bg-[#f7f7f5] px-4 py-3.5 text-left transition hover:bg-neutral-100 dark:bg-[#222224] dark:hover:bg-neutral-800 sm:items-center sm:gap-4 sm:py-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium sm:text-base">
                        {item.company || "未填写公司"}
                      </p>

                      <p className="mt-1 truncate text-xs text-neutral-400 sm:text-sm">
                        {item.role}
                      </p>

                      <p className="mt-2 truncate text-xs text-neutral-500">
                        当前进展 · {item.event}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <span
                        className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] sm:px-3 sm:py-1.5 sm:text-xs ${
                          item.diffDays === 0
                            ? "bg-red-50 text-red-600"
                            : item.diffDays === 1
                              ? "bg-orange-50 text-orange-600"
                              : "bg-[#eee9ff] text-[#6554c0]"
                        }`}
                      >
                        {dateLabel}
                      </span>

                      {item.nextDate && (
                        <p className="mt-2 text-xs text-neutral-400">
                          {item.nextDate}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <ConversionInsights applications={applications} progress={progress} />

        <Insights
          applications={applications}
          progress={progress}
          loading={loading}
        />

        <div className="mt-6 grid min-w-0 gap-6 sm:mt-8 lg:grid-cols-[420px_minmax(0,1fr)]">
          {/* 最近进展 */}
          <section className="min-w-0 rounded-[22px] border border-neutral-200 bg-white p-4 sm:rounded-[28px] sm:p-6 dark:border-neutral-800 dark:bg-[#171719]">
            <div className="mb-5 sm:mb-7">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-medium tracking-[0.16em] text-neutral-400">
                    ACTIVITY
                  </p>

                  <h2 className="mt-1 text-xl font-semibold">最近进展</h2>
                </div>

                <span className="shrink-0 text-xs text-neutral-400 sm:text-sm">
                  {visibleProgress.length} 个岗位
                </span>
              </div>

              <div className="mt-5 space-y-3">
                <div className="flex w-full rounded-full bg-[#f5f5f3] p-1 dark:bg-neutral-800">
                  <button
                    type="button"
                    onClick={() => setProgressView("active")}
                    className={`min-w-0 flex-1 rounded-full px-3 py-2 text-xs transition ${
                      progressView === "active"
                        ? "bg-white font-medium shadow-sm dark:bg-[#27272a]"
                        : "text-neutral-400"
                    }`}
                  >
                    进行中
                  </button>

                  <button
                    type="button"
                    onClick={() => setProgressView("all")}
                    className={`min-w-0 flex-1 rounded-full px-3 py-2 text-xs transition ${
                      progressView === "all"
                        ? "bg-white font-medium shadow-sm dark:bg-[#27272a]"
                        : "text-neutral-400"
                    }`}
                  >
                    全部
                  </button>
                </div>

                <input
                  value={progressSearch}
                  onChange={(event) => setProgressSearch(event.target.value)}
                  placeholder="搜索公司或岗位..."
                  className="w-full min-w-0 rounded-full border border-neutral-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-[#111113] dark:focus:border-neutral-500 sm:px-4"
                />
              </div>
            </div>

            <div className="min-w-0">
              {paginatedProgress.map((item) => {
                const applicationId = item.applicationIds?.[0];

                const applicationDate =
                  applications.find(
                    (application) => application.id === applicationId
                  )?.date ?? null;

                return (
                  <ExpandableProcess
                    key={item.id}
                    item={item}
                    allProgress={progress}
                    applicationDate={applicationDate}
                  />
                );
              })}

              {!loading && visibleProgress.length === 0 && (
                <p className="py-10 text-center text-sm text-neutral-400">
                  暂无符合条件的岗位
                </p>
              )}

              {!loading && visibleProgress.length > 0 && (
                <div className="mt-2 flex flex-col gap-3 border-t border-neutral-100 pt-4 dark:border-neutral-800 sm:mt-3 sm:pt-5">
                  <p className="text-xs text-neutral-400">
                    第 {(progressPage - 1) * PAGE_SIZE + 1}–
                    {Math.min(
                      progressPage * PAGE_SIZE,
                      visibleProgress.length
                    )} 条，共 {visibleProgress.length} 条
                  </p>

                  <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <button
                      type="button"
                      disabled={progressPage === 1}
                      onClick={() =>
                        setProgressPage((page) => Math.max(1, page - 1))
                      }
                      className="min-w-0 rounded-full border border-neutral-200 px-3 py-2.5 text-xs transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-30 dark:border-neutral-700 dark:hover:bg-neutral-800"
                    >
                      ← 上一页
                    </button>

                    <div className="flex min-w-[58px] items-center justify-center whitespace-nowrap text-xs text-neutral-500 dark:text-neutral-400">
                      {progressPage} / {totalProgressPages}
                    </div>

                    <button
                      type="button"
                      disabled={progressPage === totalProgressPages}
                      onClick={() =>
                        setProgressPage((page) =>
                          Math.min(totalProgressPages, page + 1)
                        )
                      }
                      className="min-w-0 rounded-full border border-neutral-200 px-3 py-2.5 text-xs transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-30 dark:border-neutral-700 dark:hover:bg-neutral-800"
                    >
                      下一页 →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* 我的投递 */}
          <section className="w-full min-w-0 overflow-hidden rounded-[22px] border border-neutral-200 bg-white sm:rounded-[28px] dark:border-neutral-800 dark:bg-[#171719]">
            <div className="flex items-center justify-between gap-3 px-4 pb-4 pt-5 sm:px-6 sm:pb-5 sm:pt-6">
              <div className="min-w-0">
                <p className="text-xs font-medium tracking-[0.16em] text-neutral-400">
                  APPLICATIONS
                </p>

                <h2 className="mt-1 text-xl font-semibold">我的投递</h2>
              </div>

              <div className="shrink-0">
                <AddApplicationModal />
              </div>
            </div>

            <div className="grid gap-3 border-t border-neutral-100 px-4 py-4 dark:border-neutral-800 sm:px-6 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center">
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="搜索公司、岗位、城市..."
                className="w-full min-w-0 rounded-full border border-neutral-200 bg-[#f7f7f5] px-4 py-2.5 text-sm outline-none transition focus:border-neutral-400 dark:border-neutral-700 dark:bg-[#222224] dark:focus:border-neutral-500"
              />

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="w-full min-w-0 rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm outline-none dark:border-neutral-700 dark:bg-[#111113] md:w-auto"
              >
                <option value="全部">全部状态</option>
                <option value="未投递">未投递</option>
                <option value="已投递">已投递</option>
                <option value="测评中">测评中</option>
                <option value="已测评">已测评</option>
                <option value="笔试中">笔试中</option>
                <option value="已笔试">已笔试</option>
                <option value="面试中">面试中</option>
                <option value="已挂">已挂</option>
                <option value="收到offer">收到 Offer</option>
              </select>

              <span className="text-right text-xs text-neutral-400 md:text-sm">
                {filteredApplications.length} 条
              </span>
            </div>

            {/* 手机端：卡片 */}
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800 md:hidden">
              {paginatedApplications.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => router.push(`/application/${item.id}`)}
                  className="block w-full min-w-0 px-4 py-4 text-left transition active:bg-neutral-50 dark:active:bg-neutral-800"
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {item.company || "—"}
                      </p>

                      <p className="mt-1 line-clamp-2 break-words text-sm leading-5 text-neutral-500">
                        {item.role || "—"}
                      </p>
                    </div>

                    <div className="shrink-0">
                      <StatusBadge status={item.status} />
                    </div>
                  </div>

                  <div className="mt-3 flex min-w-0 items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-xs text-neutral-400">
                      {item.base || "未填写 Base"}
                    </span>

                    <span className="shrink-0 text-xs text-neutral-300">
                      {item.date || "—"}
                    </span>
                  </div>
                </button>
              ))}

              {paginatedApplications.length === 0 && (
                <div className="px-4 py-10 text-center text-sm text-neutral-400">
                  没有符合条件的岗位
                </div>
              )}
            </div>

            {/* 桌面端：表格 */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] text-left">
                <thead>
                  <tr className="border-y border-neutral-100 text-xs text-neutral-400 dark:border-neutral-800">
                    <th className="w-[22%] px-6 py-3 font-medium">公司</th>
                    <th className="w-[40%] px-4 py-3 font-medium">岗位</th>
                    <th className="w-[18%] px-4 py-3 font-medium">状态</th>
                    <th className="w-[20%] px-6 py-3 font-medium">Base</th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedApplications.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => router.push(`/application/${item.id}`)}
                      className="cursor-pointer border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/60"
                    >
                      <td className="px-6 py-5 font-medium">
                        {item.company || "—"}
                      </td>

                      <td className="px-4 py-5 text-sm text-neutral-600">
                        {item.role || "—"}
                      </td>

                      <td className="px-4 py-5">
                        <StatusBadge status={item.status} />
                      </td>

                      <td className="px-6 py-5 text-sm text-neutral-400">
                        {item.base || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 分页必须放在“我的投递”卡片内部 */}
            <div className="flex flex-col gap-3 border-t border-neutral-100 px-4 py-4 dark:border-neutral-800 sm:px-6 sm:py-5 md:flex-row md:items-center md:justify-between">
              <p className="text-xs text-neutral-400">
                {filteredApplications.length === 0
                  ? "暂无岗位"
                  : `第 ${
                      (currentPage - 1) * PAGE_SIZE + 1
                    }–${Math.min(
                      currentPage * PAGE_SIZE,
                      filteredApplications.length
                    )} 条，共 ${filteredApplications.length} 条`}
              </p>

              <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 md:flex md:w-auto">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() =>
                    setCurrentPage((page) => Math.max(1, page - 1))
                  }
                  className="min-w-0 rounded-full border border-neutral-200 px-3 py-2.5 text-xs transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-30 dark:border-neutral-700 dark:hover:bg-neutral-800 md:px-4"
                >
                  ← 上一页
                </button>

                <div className="flex min-w-[58px] items-center justify-center whitespace-nowrap text-xs text-neutral-500">
                  {currentPage} / {totalPages}
                </div>

                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() =>
                    setCurrentPage((page) =>
                      Math.min(totalPages, page + 1)
                    )
                  }
                  className="min-w-0 rounded-full border border-neutral-200 px-3 py-2.5 text-xs transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-30 dark:border-neutral-700 dark:hover:bg-neutral-800 md:px-4"
                >
                  下一页 →
                </button>
              </div>
            </div>
          </section>
        </div>

        <footer className="mt-8 text-center text-xs text-neutral-400">
          Renaissance Job Tracker · Powered by Notion
        </footer>
      </div>
    </main>
  );
}
