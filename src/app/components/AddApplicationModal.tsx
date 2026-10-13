"use client";

import { FormEvent, useState } from "react";
import AiJobScreenshotUpload from "./AiJobScreenshotUpload";
import { MAX_JOB_DESCRIPTION_LENGTH, type ConfidenceField, type ParsedJobScreenshot } from "@/lib/job-screenshot";
import { getLocalToday, jobScreenshotPrefill } from "@/lib/job-screenshot-prefill";

export default function AddApplicationModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"choose" | "manual" | "upload" | "review">("choose");
  const [aiResult, setAiResult] = useState<ParsedJobScreenshot | null>(null);

  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [base, setBase] = useState("");
  const [status, setStatus] = useState("已投递");
  const [date, setDate] = useState(getLocalToday());
  const [note, setNote] = useState("");
  const [url, setUrl] = useState("");
  const [jobDescription, setJobDescription] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function chooseManual() {
    if (aiResult) {
      setCompany("");
      setRole("");
      setBase("");
      setStatus("已投递");
      setDate(getLocalToday());
      setNote("");
      setUrl("");
    }
    setAiResult(null);
    setJobDescription("");
    setError("");
    setStep("manual");
  }

  function prefill(job: ParsedJobScreenshot) {
    const values = jobScreenshotPrefill(job);
    setCompany(values.company);
    setRole(values.role);
    setBase(values.base);
    setStatus(values.status);
    setDate(values.date);
    setUrl(values.url);
    setJobDescription(values.jobDescription);
    setNote("");
    setAiResult(job);
    setError("");
    setStep("review");
  }

  function fieldHint(field: ConfidenceField) {
    if (!aiResult) return null;
    if (field === "status" && aiResult.status === null) {
      return <p className="mt-1.5 text-xs leading-5 text-neutral-500 dark:text-neutral-400">AI 未能确定状态，已默认填入“已投递”，可自行修改。</p>;
    }
    if (field === "applicationDate" && aiResult.applicationDate === null) {
      return <p className="mt-1.5 text-xs leading-5 text-neutral-500 dark:text-neutral-400">未识别到明确投递日期，已默认填入当天日期，可自行修改。</p>;
    }
    if (aiResult[field] !== null && aiResult.confidence[field] < 0.7) {
      return <p className="mt-1.5 text-xs leading-5 text-neutral-500 dark:text-neutral-400">识别置信度较低，请确认</p>;
    }
    return null;
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!company.trim() || !role.trim()) {
      setError("请填写公司名称和岗位名称");
      return;
    }

    if (!status) {
      setError("请选择投递状态");
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
            ...(aiResult && jobDescription.trim() ? { jobDescription: jobDescription.trim() } : {}),
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
        onClick={() => {
          setStep("choose");
          setError("");
          setOpen(true);
        }}
        className="whitespace-nowrap rounded-full bg-neutral-900 px-3.5 py-2 text-sm text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200 sm:px-4"
      >
        + 新增岗位
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/30 p-3 backdrop-blur-sm sm:p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="new-application-title" className="my-auto max-h-[calc(100dvh-24px)] w-full min-w-0 max-w-xl overflow-y-auto overscroll-contain rounded-[24px] bg-white p-5 shadow-2xl dark:bg-[#171719] sm:max-h-[90vh] sm:rounded-[30px] sm:p-7">
            <div className="mb-5 flex items-start justify-between gap-4 sm:mb-7">
              <div className="min-w-0">
                <p className="text-[10px] font-medium tracking-[0.14em] text-neutral-400 sm:text-xs sm:tracking-[0.16em]">
                  NEW APPLICATION
                </p>

                <h2 id="new-application-title" className="mt-1 text-xl font-semibold sm:text-2xl">
                  新增岗位
                </h2>
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-lg text-neutral-500 transition hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                aria-label="关闭"
              >
                ×
              </button>
            </div>

            {step === "choose" && (
              <div className="grid min-w-0 gap-3">
                <p className="mb-1 text-sm text-neutral-500">选择新增方式</p>
                <button type="button" onClick={chooseManual} className="min-w-0 rounded-2xl border border-neutral-200 bg-[#f7f7f5] p-4 text-left transition hover:border-neutral-400 dark:border-neutral-700 dark:bg-[#222224]">
                  <span className="block text-base font-medium">手动填写</span>
                  <span className="mt-1 block text-sm leading-6 text-neutral-500 dark:text-neutral-400">自己填写公司、岗位、Base、日期等信息</span>
                </button>
                <button type="button" onClick={() => { setError(""); setStep("upload"); }} className="min-w-0 rounded-2xl border border-neutral-200 bg-[#f7f7f5] p-4 text-left transition hover:border-neutral-400 dark:border-neutral-700 dark:bg-[#222224]">
                  <span className="block text-base font-medium">AI 截图识别</span>
                  <span className="mt-1 block text-sm leading-6 text-neutral-500 dark:text-neutral-400">上传招聘页面、投递成功页或招聘通知截图，AI 自动识别岗位信息</span>
                </button>
              </div>
            )}

            {(step === "upload" || step === "review") && (
              <div hidden={step !== "upload"}>
                <AiJobScreenshotUpload active={step === "upload"} onRecognized={prefill} onManual={chooseManual} />
              </div>
            )}

            {(step === "manual" || step === "review") && (
            <form
              onSubmit={handleSubmit}
              className="space-y-4 sm:space-y-5"
            >
              {aiResult && step === "review" && (
                <p className="rounded-2xl bg-[#f7f7f5] px-4 py-3 text-sm leading-6 text-neutral-500 dark:bg-[#222224] dark:text-neutral-400">AI 识别可能存在误差，请在保存前确认公司、岗位、日期和状态。</p>
              )}
              {step === "manual" && <button type="button" onClick={() => setStep("choose")} disabled={saving} className="text-sm text-neutral-500">← 选择新增方式</button>}
              <div>
                <label htmlFor="application-company" className="mb-2 block text-sm font-medium">
                  公司名称
                </label>

                <input
                  id="application-company"
                  value={company}
                  onChange={(e) =>
                    setCompany(e.target.value)
                  }
                  placeholder="例如：小红书"
                  className="w-full min-w-0 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-base outline-none transition focus:border-neutral-400 dark:border-neutral-700 dark:bg-[#111113] dark:focus:border-neutral-500 sm:text-sm"
                />
                {fieldHint("company")}
              </div>

              <div>
                <label htmlFor="application-role" className="mb-2 block text-sm font-medium">
                  岗位名称
                </label>

                <input
                  id="application-role"
                  value={role}
                  onChange={(e) =>
                    setRole(e.target.value)
                  }
                  placeholder="例如：内容运营"
                  className="w-full min-w-0 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-base outline-none transition focus:border-neutral-400 dark:border-neutral-700 dark:bg-[#111113] dark:focus:border-neutral-500 sm:text-sm"
                />
                {fieldHint("position")}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <label htmlFor="application-base" className="mb-2 block text-sm font-medium">
                    Base
                  </label>

                  <input
                    id="application-base"
                    value={base}
                    onChange={(e) =>
                      setBase(e.target.value)
                    }
                    placeholder="上海"
                    className="w-full min-w-0 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-base outline-none transition focus:border-neutral-400 dark:border-neutral-700 dark:bg-[#111113] dark:focus:border-neutral-500 sm:text-sm"
                  />
                  {fieldHint("base")}
                </div>

                <div className="min-w-0">
                  <label htmlFor="application-date" className="mb-2 block text-sm font-medium">
                    日期
                  </label>

                  <input
                    id="application-date"
                    type="date"
                    value={date}
                    onChange={(e) =>
                      setDate(e.target.value)
                    }
                    className="w-full min-w-0 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-base outline-none transition focus:border-neutral-400 dark:border-neutral-700 dark:bg-[#111113] dark:focus:border-neutral-500 sm:text-sm"
                  />
                  {fieldHint("applicationDate")}
                </div>
              </div>

              <div>
                <label htmlFor="application-status" className="mb-2 block text-sm font-medium">
                  投递状态
                </label>

                <select
                  id="application-status"
                  required
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value)
                  }
                  className="w-full min-w-0 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-base outline-none transition focus:border-neutral-400 dark:border-neutral-700 dark:bg-[#111113] dark:focus:border-neutral-500 sm:text-sm"
                >
                  <option value="" disabled>请选择状态</option>
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
                {fieldHint("status")}
              </div>

              <div>
                <label htmlFor="application-url" className="mb-2 block text-sm font-medium">
                  官网 / JD 链接
                </label>

                <input
                  id="application-url"
                  value={url}
                  onChange={(e) =>
                    setUrl(e.target.value)
                  }
                  placeholder="https://..."
                  inputMode="url"
                  className="w-full min-w-0 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-base outline-none transition focus:border-neutral-400 dark:border-neutral-700 dark:bg-[#111113] dark:focus:border-neutral-500 sm:text-sm"
                />
              </div>

              {step === "review" && (
                <div>
                  <label htmlFor="application-jd" className="mb-2 block text-sm font-medium">JD / 职位描述</label>
                  <textarea
                    id="application-jd"
                    value={jobDescription}
                    onChange={(event) => setJobDescription(event.target.value)}
                    maxLength={MAX_JOB_DESCRIPTION_LENGTH}
                    rows={5}
                    placeholder="截图中可见的岗位职责、任职要求等"
                    className="max-h-64 w-full min-w-0 resize-y overflow-y-auto rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-base outline-none transition focus:border-neutral-400 dark:border-neutral-700 dark:bg-[#111113] dark:focus:border-neutral-500 sm:text-sm"
                  />
                  <p className="mt-1.5 text-xs leading-5 text-neutral-500 dark:text-neutral-400">保存非空 JD 需要 Notion Applications 中存在 JD / 职位描述等富文本字段；不会自动创建字段。</p>
                </div>
              )}

              <div>
                <label htmlFor="application-note" className="mb-2 block text-sm font-medium">
                  备注
                </label>

                <textarea
                  id="application-note"
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
                  onClick={() => aiResult ? setStep("upload") : setOpen(false)}
                  disabled={saving}
                  className="w-full rounded-full border border-neutral-200 px-4 py-2.5 text-sm dark:border-neutral-700 sm:w-auto sm:px-5"
                >
                  {aiResult ? "重新识别" : "取消"}
                </button>

                <button
                  type="submit"
                  disabled={saving || !status}
                  className="w-full rounded-full bg-neutral-900 px-4 py-2.5 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900 sm:w-auto sm:px-6"
                >
                  {saving
                    ? "正在保存..."
                    : aiResult ? "确认并新增" : "保存岗位"}
                </button>
              </div>
            </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
