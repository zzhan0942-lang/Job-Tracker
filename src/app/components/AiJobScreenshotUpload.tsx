"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  isScreenshotMimeType,
  MAX_SCREENSHOT_BYTES,
  parseJobScreenshotResult,
  SCREENSHOT_ERROR,
  type ParsedJobScreenshot,
} from "@/lib/job-screenshot";

type Props = {
  onRecognized: (job: ParsedJobScreenshot) => void;
  onManual: () => void;
};

export default function AiJobScreenshotUpload({ onRecognized, onManual }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [recognizing, setRecognizing] = useState(false);
  const [error, setError] = useState("");
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => () => requestRef.current?.abort(), []);

  function selectFile(selected: File | undefined) {
    setError("");
    setFile(null);
    setPreviewUrl(null);
    if (!selected) return;
    if (!isScreenshotMimeType(selected.type)) {
      setError("请上传 PNG、JPEG 或 WebP 图片。");
      return;
    }
    if (selected.size === 0 || selected.size > MAX_SCREENSHOT_BYTES) {
      setError("请上传不超过 10MB 的有效图片。");
      return;
    }
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
  }

  async function recognize() {
    if (requestRef.current) return;
    if (!file) {
      setError("请先上传一张截图。");
      return;
    }
    const controller = new AbortController();
    requestRef.current = controller;
    setRecognizing(true);
    setError("");
    try {
      const response = await fetch("/api/ai/parse-job-screenshot", {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(55_000)]),
      });
      if (!response.ok) throw new Error("Recognition failed");
      const data = await response.json();
      const job = data.success === true ? parseJobScreenshotResult(data.job) : null;
      if (!job || (!job.company && !job.position)) throw new Error("Invalid recognition result");
      if (!controller.signal.aborted) onRecognized(job);
    } catch {
      if (!controller.signal.aborted) setError(SCREENSHOT_ERROR);
    } finally {
      requestRef.current = null;
      if (!controller.signal.aborted) setRecognizing(false);
    }
  }

  return (
    <div className="min-w-0 space-y-4" aria-busy={recognizing}>
      <div>
        <h3 className="text-base font-semibold">AI 截图识别</h3>
        <p className="mt-1 text-sm leading-6 text-neutral-500 dark:text-neutral-400">
          上传招聘官网、App、小程序、投递成功页或邮件 / 通知截图。
        </p>
      </div>

      <label className={`flex min-w-0 flex-col items-center gap-2 rounded-2xl border border-dashed border-neutral-300 bg-[#f7f7f5] px-4 py-6 text-center dark:border-neutral-700 dark:bg-[#222224] ${recognizing ? "opacity-60" : "cursor-pointer hover:border-neutral-500"}`}>
        <span className="text-sm font-medium">{file ? "更换截图" : "点击上传截图"}</span>
        <span className="text-xs text-neutral-500">PNG / JPEG / WebP · 单张不超过 10MB</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-label="上传招聘截图"
          disabled={recognizing}
          className="sr-only"
          onChange={(event) => {
            selectFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </label>

      {previewUrl && (
        <div className="min-w-0 rounded-2xl bg-neutral-100 p-2 dark:bg-neutral-800">
          <Image
            src={previewUrl}
            alt="待识别的招聘截图预览"
            width={900}
            height={700}
            unoptimized
            className="mx-auto h-auto max-h-64 w-auto max-w-full rounded-xl object-contain"
            onError={() => {
              setFile(null);
              setPreviewUrl(null);
              setError("图片无法读取，请更换截图。");
            }}
          />
        </div>
      )}

      <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
        截图将发送至 AI 服务进行识别，请避免上传包含身份证号、密码等敏感信息的图片。
      </p>

      {error && <p role="alert" className="rounded-xl bg-neutral-100 px-3 py-2 text-sm text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">{error}</p>}
      <p role="status" className="text-sm text-neutral-500">{recognizing ? "AI 正在识别岗位信息..." : "识别后请检查并确认岗位信息。"}</p>

      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:justify-end">
        <button type="button" onClick={onManual} disabled={recognizing} className="rounded-full border border-neutral-200 px-4 py-2.5 text-sm disabled:opacity-50 dark:border-neutral-700">手动填写</button>
        <button type="button" onClick={recognize} disabled={recognizing || !file} className="rounded-full bg-neutral-900 px-5 py-2.5 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900">{recognizing ? "正在识别..." : "开始识别"}</button>
      </div>
    </div>
  );
}
