"use client";

import ProcessOverview from "../../components/ProcessOverview";
import StatusBadge from "../../components/StatusBadge";
import ProgressActions from "../../components/ProgressActions";
import EditApplicationModal from "../../components/EditApplicationModal";
import AddProgressModal from "../../components/AddProgressModal";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

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

export default function ApplicationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const id = params.id;

  const [application, setApplication] =
    useState<Application | null>(null);

  const [progress, setProgress] =
    useState<ProgressEvent[]>([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [applicationResponse, progressResponse] =
          await Promise.all([
            fetch("/api/notion-test"),
            fetch("/api/progress"),
          ]);

        const applicationData =
          await applicationResponse.json();

        const progressData =
          await progressResponse.json();

        if (applicationData.success) {
          const current =
            applicationData.applications.find(
              (item: Application) => item.id === id
            );

          setApplication(current || null);
        }

        if (progressData.success) {
          const related =
            progressData.progress.filter(
              (item: ProgressEvent) =>
                item.applicationIds.includes(id)
            );

          setProgress(related);
        }
      } catch (error) {
        console.error("读取岗位详情失败：", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [id]);

  const timeline = useMemo(() => {
    return [...progress].sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;

      return b.date.localeCompare(a.date);
    });
  }, [progress]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f5f5f3] px-4 py-8 text-sm text-neutral-500 dark:bg-[#101011] dark:text-neutral-400 sm:px-6 sm:py-10">
        正在读取岗位信息...
      </main>
    );
  }

  if (!application) {
    return (
      <main className="min-h-screen bg-[#f5f5f3] px-4 py-8 text-sm text-neutral-500 dark:bg-[#101011] dark:text-neutral-400 sm:px-6 sm:py-10">
        没有找到这个岗位。
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f5f5f3] text-[#171717] dark:bg-[#101011] dark:text-[#f5f5f5]">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10 lg:px-10">
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-7 text-sm text-neutral-500 transition hover:text-black dark:text-neutral-400 dark:hover:text-white sm:mb-10"
        >
          ← 返回求职控制台
        </button>

        <header className="mb-8 sm:mb-10">
          <p className="mb-3 text-xs font-medium tracking-[0.18em] text-neutral-400">
            APPLICATION DETAIL
          </p>

          <div className="flex min-w-0 flex-col gap-5 sm:gap-6 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <h1 className="break-words text-3xl font-semibold tracking-tight sm:text-4xl">
                {application.company}
              </h1>

              <p className="mt-3 break-words text-base leading-6 text-neutral-500 sm:text-xl">
                {application.role}
              </p>
            </div>

            <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:shrink-0 md:justify-end">
              <StatusBadge status={application.status} />

              <EditApplicationModal
                application={application}
              />

              <button
                type="button"
                onClick={async () => {
                  const confirmed = window.confirm(
                    `确定删除「${application.company}｜${application.role}」吗？\n\n这个岗位以及它的进展记录都会进入 Notion 回收站。`
                  );

                  if (!confirmed) return;

                  const response = await fetch(
                    "/api/applications",
                    {
                      method: "DELETE",

                      headers: {
                        "Content-Type": "application/json",
                      },

                      body: JSON.stringify({
                        id: application.id,
                        progressIds: progress.map(
                          (item) => item.id
                        ),
                      }),
                    }
                  );

                  const data = await response.json();

                  if (data.success) {
                    router.push("/");
                  } else {
                    alert(data.error || "删除失败");
                  }
                }}
                className="rounded-full border border-red-200 px-4 py-2 text-sm text-red-500 transition hover:bg-red-50 dark:border-red-950 dark:hover:bg-red-950/50"
              >
                删除岗位
              </button>
            </div>
          </div>
        </header>

        {/* 基础信息 */}
        <section className="mb-6 grid grid-cols-2 gap-3 sm:mb-8 sm:gap-4 md:grid-cols-3">
          <div className="min-w-0 rounded-[22px] border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-[#171719] sm:rounded-3xl sm:p-5">
            <p className="text-xs text-neutral-400">
              BASE
            </p>

            <p className="mt-3 truncate font-medium">
              {application.base || "—"}
            </p>
          </div>

          <div className="min-w-0 rounded-[22px] border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-[#171719] sm:rounded-3xl sm:p-5">
            <p className="text-xs text-neutral-400">
              投递日期
            </p>

            <p className="mt-3 whitespace-nowrap font-medium">
              {application.date || "—"}
            </p>
          </div>

          <div className="col-span-2 min-w-0 rounded-[22px] border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-[#171719] sm:rounded-3xl sm:p-5 md:col-span-1">
            <p className="text-xs text-neutral-400">
              进展记录
            </p>

            <p className="mt-3 text-2xl font-semibold">
              {timeline.length}
            </p>
          </div>
        </section>

        {/* 完整求职流程 */}
        <div className="mb-6 min-w-0 overflow-hidden sm:mb-8">
          <ProcessOverview
            progress={timeline}
            applicationDate={application.date}
          />
        </div>

        {/* 时间线 */}
        <section className="min-w-0 overflow-hidden rounded-[22px] border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-[#171719] sm:rounded-[30px] sm:p-7">
          <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-medium tracking-[0.16em] text-neutral-400">
                TIMELINE
              </p>

              <h2 className="mt-1 text-xl font-semibold sm:text-2xl">
                求职时间线
              </h2>
            </div>

            <div className="w-full sm:w-auto sm:shrink-0">
              <AddProgressModal
                applicationId={application.id}
                company={application.company}
                role={application.role}
              />
            </div>
          </div>

          {timeline.length === 0 ? (
            <div className="py-12 text-center text-sm text-neutral-400 sm:py-16">
              暂无进展记录
            </div>
          ) : (
            <div className="min-w-0">
              {timeline.map((item, index) => (
                <div
                  key={item.id}
                  className="relative flex min-w-0 gap-4 pb-8 last:pb-0 sm:gap-6 sm:pb-9"
                >
                  <div className="relative flex w-4 shrink-0 justify-center sm:w-5">
                    <div className="z-10 mt-1 h-3 w-3 rounded-full bg-neutral-900 dark:bg-white" />

                    {index !== timeline.length - 1 && (
                      <div className="absolute bottom-[-4px] top-4 w-px bg-neutral-200 dark:bg-neutral-800" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <h3 className="break-words font-semibold">
                          {item.event || "未设置事件"}
                        </h3>

                        <p className="mt-1 text-sm text-neutral-400">
                          {item.date || "未设置日期"}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2 sm:shrink-0 sm:justify-end">
                        {item.stage && (
                          <span className="rounded-full bg-[#eee9ff] px-3 py-1 text-xs text-[#6554c0] dark:bg-violet-950 dark:text-violet-300">
                            {item.stage}
                          </span>
                        )}

                        {item.result && (
                          <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs dark:bg-neutral-800">
                            {item.result}
                          </span>
                        )}
                      </div>
                    </div>

                    {item.note && (
                      <p className="mt-3 break-words text-sm leading-6 text-neutral-500">
                        {item.note}
                      </p>
                    )}

                    {item.nextDate && (
                      <p className="mt-3 text-xs text-neutral-400">
                        下一步：{item.nextDate}
                      </p>
                    )}

                    {item.link && (
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-block break-all text-sm underline underline-offset-4"
                      >
                        查看相关链接 ↗
                      </a>
                    )}

                    <div className="mt-4 min-w-0 overflow-x-auto">
                      <ProgressActions
                        item={item}
                        isLatest={index === 0}
                        previousItem={
                          index === 0
                            ? timeline[1]
                            : undefined
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
