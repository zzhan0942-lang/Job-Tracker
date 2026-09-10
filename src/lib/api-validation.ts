const APPLICATION_STATUSES = [
  "未投递",
  "已投递",
  "测评中",
  "已测评",
  "笔试中",
  "已笔试",
  "面试中",
  "已挂",
  "收到offer",
] as const;

const PROGRESS_EVENTS = [
  "投递",
  "收到测评",
  "完成测评",
  "收到笔试",
  "完成笔试",
  "收到AI面",
  "完成AI面",
  "收到一面",
  "完成一面",
  "收到二面",
  "完成二面",
  "收到三面",
  "完成三面",
  "收到HR面",
  "完成HR面",
  "收到Offer",
  "淘汰",
  "主动放弃",
  "流程暂停",
  "其他",
] as const;

const PROGRESS_STAGES = [
  "投递",
  "测评",
  "笔试",
  "AI面",
  "面试",
  "HR",
  "Offer",
] as const;

const PROGRESS_RESULTS = [
  "流程中",
  "待定",
  "通过",
  "淘汰",
  "主动放弃",
  "Offer",
  "流程终止",
  "无结果",
] as const;

type ObjectRecord = Record<string, unknown>;

export type ApplicationInput = {
  id?: string;
  company: string;
  role: string;
  base: string;
  status: (typeof APPLICATION_STATUSES)[number];
  date: string | null;
  note: string;
  url: string | null;
};

export type ProgressInput = {
  id?: string;
  applicationId?: string;
  company: string;
  role: string;
  event: (typeof PROGRESS_EVENTS)[number];
  stage: (typeof PROGRESS_STAGES)[number];
  result: (typeof PROGRESS_RESULTS)[number];
  date: string | null;
  nextDate: string | null;
  note: string;
  link: string | null;
  syncStatus: boolean;
  fallbackStatus?: (typeof APPLICATION_STATUSES)[number];
};

export function badRequestResponse() {
  return Response.json(
    { success: false, error: "请求参数无效" },
    { status: 400 }
  );
}

export async function readJson(request: Request): Promise<unknown | null> {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().includes("application/json")) {
    return null;
  }

  try {
    return await request.json();
  } catch {
    return null;
  }
}

function isObject(value: unknown): value is ObjectRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function hasOnlyKeys(value: ObjectRecord, allowedKeys: string[]) {
  return Object.keys(value).every((key) => allowedKeys.includes(key));
}

function text(
  value: unknown,
  maxLength: number,
  required = false
): string | null {
  if (typeof value !== "string") return required ? null : "";

  const normalized = value.trim();

  if (
    normalized.length > maxLength ||
    (required && normalized.length === 0)
  ) {
    return null;
  }

  return normalized;
}

function enumValue<T extends readonly string[]>(
  value: unknown,
  values: T
): T[number] | null {
  return typeof value === "string" && values.includes(value as T[number])
    ? (value as T[number])
    : null;
}

function optionalDate(value: unknown): string | null | undefined {
  if (value === undefined || value === "") return null;
  if (typeof value !== "string") return undefined;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) return undefined;

  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? value
    : undefined;
}

function optionalUrl(value: unknown): string | null | undefined {
  if (value === undefined || value === "") return null;
  if (typeof value !== "string" || value.length > 2048) return undefined;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function pageId(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const normalized = value.trim();

  return /^(?:[0-9a-f]{32}|[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})$/i.test(
    normalized
  )
    ? normalized
    : null;
}

function optionalBoolean(value: unknown): boolean | undefined {
  return value === undefined ? false : typeof value === "boolean" ? value : undefined;
}

export function parseApplicationInput(
  body: unknown,
  requireId: boolean
): ApplicationInput | null {
  if (!isObject(body)) return null;

  const allowedKeys = [
    "id",
    "company",
    "role",
    "base",
    "status",
    "date",
    "note",
    "url",
  ];

  if (!hasOnlyKeys(body, allowedKeys)) return null;

  const id = body.id === undefined ? undefined : pageId(body.id);
  const company = text(body.company, 200, true);
  const role = text(body.role, 200, true);
  const base = text(body.base, 200);
  const status =
    body.status === undefined
      ? "已投递"
      : enumValue(body.status, APPLICATION_STATUSES);
  const date = optionalDate(body.date);
  const note = text(body.note, 2_000);
  const url = optionalUrl(body.url);

  if (
    company === null ||
    role === null ||
    base === null ||
    status === null ||
    date === undefined ||
    note === null ||
    url === undefined ||
    (requireId && !id) ||
    (!requireId && body.id !== undefined)
  ) {
    return null;
  }

  return {
    id: id ?? undefined,
    company,
    role,
    base,
    status,
    date,
    note,
    url,
  };
}

export function parseApplicationDelete(body: unknown): { id: string } | null {
  if (!isObject(body) || !hasOnlyKeys(body, ["id"])) return null;

  const id = pageId(body.id);
  return id ? { id } : null;
}

export function parseProgressInput(
  body: unknown,
  requireId: boolean
): ProgressInput | null {
  if (!isObject(body)) return null;

  const allowedKeys = [
    "id",
    "applicationId",
    "company",
    "role",
    "event",
    "stage",
    "result",
    "date",
    "nextDate",
    "note",
    "link",
    "syncStatus",
    "fallbackStatus",
  ];

  if (!hasOnlyKeys(body, allowedKeys)) return null;

  const id = body.id === undefined ? undefined : pageId(body.id);
  const applicationId =
    body.applicationId === undefined ? undefined : pageId(body.applicationId);
  const company = text(body.company, 200);
  const role = text(body.role, 200);
  const event = enumValue(body.event, PROGRESS_EVENTS);
  const stage = enumValue(body.stage, PROGRESS_STAGES);
  const result = enumValue(body.result, PROGRESS_RESULTS);
  const date = optionalDate(body.date);
  const nextDate = optionalDate(body.nextDate);
  const note = text(body.note, 2_000);
  const link = optionalUrl(body.link);
  const syncStatus = optionalBoolean(body.syncStatus);
  const fallbackStatus =
    body.fallbackStatus === undefined
      ? undefined
      : enumValue(body.fallbackStatus, APPLICATION_STATUSES);

  if (
    company === null ||
    role === null ||
    event === null ||
    stage === null ||
    result === null ||
    date === undefined ||
    nextDate === undefined ||
    note === null ||
    link === undefined ||
    syncStatus === undefined ||
    (body.applicationId !== undefined && !applicationId) ||
    (body.fallbackStatus !== undefined && !fallbackStatus) ||
    (requireId && !id) ||
    (!requireId && (body.id !== undefined || !applicationId))
  ) {
    return null;
  }

  return {
    id: id ?? undefined,
    applicationId: applicationId ?? undefined,
    company,
    role,
    event,
    stage,
    result,
    date,
    nextDate,
    note,
    link,
    syncStatus,
    fallbackStatus: fallbackStatus ?? undefined,
  };
}

export function parseProgressDelete(
  body: unknown
): {
  id: string;
  applicationId?: string;
  syncStatus: boolean;
  fallbackStatus?: (typeof APPLICATION_STATUSES)[number];
} | null {
  if (!isObject(body)) return null;

  const allowedKeys = [
    "id",
    "applicationId",
    "syncStatus",
    "fallbackStatus",
  ];

  if (!hasOnlyKeys(body, allowedKeys)) return null;

  const id = pageId(body.id);
  const applicationId =
    body.applicationId === undefined ? undefined : pageId(body.applicationId);
  const syncStatus = optionalBoolean(body.syncStatus);
  const fallbackStatus =
    body.fallbackStatus === undefined
      ? undefined
      : enumValue(body.fallbackStatus, APPLICATION_STATUSES);

  if (
    !id ||
    (body.applicationId !== undefined && !applicationId) ||
    syncStatus === undefined ||
    (body.fallbackStatus !== undefined && !fallbackStatus)
  ) {
    return null;
  }

  return {
    id,
    applicationId: applicationId ?? undefined,
    syncStatus,
    fallbackStatus: fallbackStatus ?? undefined,
  };
}
