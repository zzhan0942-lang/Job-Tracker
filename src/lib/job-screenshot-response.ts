import "server-only";

import {
  JOB_STATUSES,
  parseJobScreenshotResult,
  type ConfidenceField,
  type JobStatus,
  type ParsedJobScreenshot,
} from "./job-screenshot";

// Paths and codes are fixed by this module. Never include model values or raw keys in diagnostics.
export type ValidationIssue = {
  field: string;
  type: "undefined" | "null" | "array" | "object" | "string" | "number" | "boolean" | "other";
  reason: string;
};

type NormalizationResult = {
  job: ParsedJobScreenshot | null;
  issues: ValidationIssue[];
  failure: "invalid_json" | "invalid_fields" | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function valueType(value: unknown): ValidationIssue["type"] {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  const type = typeof value;
  return ["undefined", "object", "string", "number", "boolean"].includes(type)
    ? type as ValidationIssue["type"]
    : "other";
}

const STATUS_ALIASES: Record<string, JobStatus> = {
  简历已提交: "已投递",
  简历提交成功: "已投递",
  投递成功: "已投递",
  已提交申请: "已投递",
  申请已提交: "已投递",
  测评待完成: "测评中",
  测评邀请: "测评中",
  收到测评: "测评中",
  完成测评: "已测评",
  笔试邀请: "笔试中",
  笔试待完成: "笔试中",
  收到笔试: "笔试中",
  完成笔试: "已笔试",
  进入面试: "面试中",
  面试邀请: "面试中",
  很遗憾未通过: "已挂",
  未通过: "已挂",
  淘汰: "已挂",
  恭喜录用: "收到offer",
  已录用: "收到offer",
  收到Offer: "收到offer",
  收到OFFER: "收到offer",
};

const APPLICATION_DATE_LABEL = /(?:投递|申请)(?:提交)?(?:时间|日期)|已投递时间/;
const NON_APPLICATION_DATE_LABEL = /发布|职位发布时间|更新|通知|面试|截止|截图/;

function explicitDate(value: string): string | null {
  const match = /(?:^|[^\d])(\d{4})\s*[-/.年]\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})(?:日)?(?:$|[^\d])/.exec(value);
  if (!match) return null;
  const date = `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : null;
}

export function normalizeJobScreenshotResponse(value: unknown): NormalizationResult {
  const issues: ValidationIssue[] = [];
  function issue(field: string, input: unknown, reason: string) {
    issues.push({ field, type: valueType(input), reason });
  }
  if (!isRecord(value)) {
    issue("response", value, "expected_object");
    return { job: null, issues, failure: "invalid_fields" };
  }

  function text(field: string, input: unknown, maxLength: number): string | null {
    if (input === null) return null;
    if (input === undefined) {
      issue(field, input, "missing_field");
      return null;
    }
    if (typeof input !== "string") {
      issue(field, input, "expected_string");
      return null;
    }
    const result = input.trim();
    if (result.length > maxLength) {
      issue(field, input, "too_long");
      return null;
    }
    return result || null;
  }

  const company = text("company", value.company, 200);
  const position = text("position", value.position, 200);
  let base: string | null;
  if (Array.isArray(value.base)) {
    if (value.base.every((entry) => typeof entry === "string")) {
      base = text("base", value.base.map((entry) => entry.trim()).filter(Boolean).join("，"), 200);
      issue("base", value.base, "array_joined");
    } else {
      base = null;
      issue("base", value.base, "expected_string_array");
    }
  } else {
    base = text("base", value.base, 200);
  }

  const statusText = text("status", value.status, 100);
  let status: JobStatus | null = null;
  if (statusText) {
    if (JOB_STATUSES.some((entry) => entry === statusText)) {
      status = statusText as JobStatus;
    } else if (Object.hasOwn(STATUS_ALIASES, statusText)) {
      status = STATUS_ALIASES[statusText];
      issue("status", value.status, "alias_mapped");
    } else {
      issue("status", value.status, "unmapped_status");
    }
  }

  const dateText = text("applicationDate", value.applicationDate, 200);
  let applicationDate: string | null = null;
  if (dateText) {
    // A bare date alone cannot distinguish an application date from a JD publication date.
    const evidence = typeof value.applicationDateEvidence === "string"
      ? value.applicationDateEvidence.trim().slice(0, 500)
      : "";
    const source = APPLICATION_DATE_LABEL.test(dateText) ? dateText : evidence;
    const date = explicitDate(dateText);
    if (NON_APPLICATION_DATE_LABEL.test(dateText) || NON_APPLICATION_DATE_LABEL.test(source)) {
      issue("applicationDate", value.applicationDate, "non_application_date");
    } else if (!APPLICATION_DATE_LABEL.test(source)) {
      issue("applicationDate", value.applicationDate, "missing_application_date_evidence");
    } else if (!date || explicitDate(source) !== date) {
      issue("applicationDate", value.applicationDate, "invalid_or_mismatched_date");
    } else {
      applicationDate = date;
    }
  }

  let officialUrl = text("officialUrl", value.officialUrl, 2048);
  if (officialUrl) {
    try {
      const url = new URL(officialUrl);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
        issue("officialUrl", value.officialUrl, "unsafe_url");
        officialUrl = null;
      }
    } catch {
      issue("officialUrl", value.officialUrl, "invalid_url");
      officialUrl = null;
    }
  }

  const confidenceInput = isRecord(value.confidence) ? value.confidence : {};
  if (!isRecord(value.confidence)) issue("confidence", value.confidence, "expected_object");
  const confidence = {} as Record<ConfidenceField, number>;
  const fields: ConfidenceField[] = ["company", "position", "base", "applicationDate", "status"];
  const normalizedFields = { company, position, base, applicationDate, status };
  for (const field of fields) {
    const input = confidenceInput[field];
    // Only decimal numeric strings are accepted, not booleans, empty strings, hex or objects.
    const converted = typeof input === "number" ? input
      : typeof input === "string" && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(input.trim())
        ? Number(input.trim()) : NaN;
    if (!Number.isFinite(converted)) {
      confidence[field] = 0;
      issue(`confidence.${field}`, input, "expected_number");
    } else {
      confidence[field] = normalizedFields[field] === null ? 0 : Math.max(0, Math.min(1, converted));
      if (converted < 0 || converted > 1) issue(`confidence.${field}`, input, "clamped_out_of_range");
    }
  }

  const job = parseJobScreenshotResult({ company, position, base, applicationDate, status, officialUrl, confidence });
  if (!job) issue("response", value, "normalized_schema_mismatch");
  return { job, issues, failure: job ? null : "invalid_fields" };
}

export function parseJobScreenshotResponse(content: string): NormalizationResult {
  const trimmed = content.trim();
  // Strip only one complete Markdown code fence. Do not evaluate code or guess a JSON fragment.
  const fenced = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i.exec(trimmed);
  try {
    return normalizeJobScreenshotResponse(JSON.parse(fenced ? fenced[1].trim() : trimmed));
  } catch {
    return {
      job: null,
      failure: "invalid_json",
      issues: [{ field: "response", type: "string", reason: "invalid_json" }],
    };
  }
}
