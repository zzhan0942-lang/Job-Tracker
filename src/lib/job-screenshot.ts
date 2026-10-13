// Shared, public types and limits only. Provider credentials live in deepseek.ts.
export const SCREENSHOT_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_SCREENSHOT_BYTES = 10 * 1024 * 1024;
export const SCREENSHOT_ERROR = "识别失败，请重试或使用手动填写。";
export const MAX_JOB_DESCRIPTION_LENGTH = 12_000;

export const JOB_STATUSES = [
  "未投递", "已投递", "测评中", "已测评", "笔试中", "已笔试", "面试中", "已挂", "收到offer",
] as const;

export type ScreenshotMimeType = (typeof SCREENSHOT_MIME_TYPES)[number];
export type JobStatus = (typeof JOB_STATUSES)[number];
export type ConfidenceField = "company" | "position" | "base" | "applicationDate" | "status";
export type ParsedJobScreenshot = {
  company: string | null;
  position: string | null;
  base: string | null;
  applicationDate: string | null;
  status: JobStatus | null;
  officialUrl: string | null;
  jobDescription: string | null;
  confidence: Record<ConfidenceField, number>;
};

export function isScreenshotMimeType(value: string): value is ScreenshotMimeType {
  return SCREENSHOT_MIME_TYPES.some((type) => type === value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]) {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function nullableText(value: unknown, maxLength: number): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string" || value.length > maxLength) return undefined;
  return value.trim() || null;
}

export function parseJobScreenshotResult(value: unknown): ParsedJobScreenshot | null {
  if (!isRecord(value) || !hasExactKeys(value, [
    "company", "position", "base", "applicationDate", "status", "officialUrl", "jobDescription", "confidence",
  ])) return null;

  const company = nullableText(value.company, 200);
  const position = nullableText(value.position, 200);
  const base = nullableText(value.base, 200);
  const applicationDate = nullableText(value.applicationDate, 10);
  const officialUrl = nullableText(value.officialUrl, 2048);
  const jobDescription = nullableText(value.jobDescription, MAX_JOB_DESCRIPTION_LENGTH);
  if ([company, position, base, applicationDate, officialUrl, jobDescription].some((field) => field === undefined)) return null;

  if (applicationDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(applicationDate)) return null;
    const date = new Date(`${applicationDate}T00:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== applicationDate) return null;
  }

  if (officialUrl) {
    try {
      const url = new URL(officialUrl);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    } catch {
      return null;
    }
  }

  if (value.status !== null && !JOB_STATUSES.some((status) => status === value.status)) return null;
  const fields: ConfidenceField[] = ["company", "position", "base", "applicationDate", "status"];
  if (!isRecord(value.confidence) || !hasExactKeys(value.confidence, fields)) return null;
  const confidence = {} as Record<ConfidenceField, number>;
  for (const field of fields) {
    const score = value.confidence[field];
    if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 1) return null;
    confidence[field] = score;
  }

  return {
    company: company ?? null,
    position: position ?? null,
    base: base ?? null,
    applicationDate: applicationDate ?? null,
    status: value.status as JobStatus | null,
    officialUrl: officialUrl ?? null,
    jobDescription: jobDescription ?? null,
    confidence,
  };
}
