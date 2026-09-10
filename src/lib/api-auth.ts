import { timingSafeEqual } from "node:crypto";

const AUTHENTICATE_HEADER =
  'Basic realm="Job Tracker", charset="UTF-8"';

function safeEqual(left: string, right: string) {
  const leftValue = Buffer.from(left);
  const rightValue = Buffer.from(right);

  return (
    leftValue.length === rightValue.length &&
    timingSafeEqual(leftValue, rightValue)
  );
}

function unauthorizedResponse() {
  return Response.json(
    { success: false, error: "需要身份验证" },
    {
      status: 401,
      headers: { "WWW-Authenticate": AUTHENTICATE_HEADER },
    }
  );
}

/**
 * This application is intentionally single-user. Keep these values server-only:
 * JOB_TRACKER_AUTH_USERNAME and JOB_TRACKER_AUTH_PASSWORD.
 */
export function requireApiAuth(request: Request): Response | null {
  const username = process.env.JOB_TRACKER_AUTH_USERNAME;
  const password = process.env.JOB_TRACKER_AUTH_PASSWORD;

  if (!username || !password) {
    console.error("API authentication is not configured");
    return Response.json(
      { success: false, error: "服务暂不可用" },
      { status: 503 }
    );
  }

  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Basic ")) {
    return unauthorizedResponse();
  }

  let credentials: string;

  try {
    credentials = Buffer.from(
      authorization.slice("Basic ".length),
      "base64"
    ).toString("utf8");
  } catch {
    return unauthorizedResponse();
  }

  const separator = credentials.indexOf(":");

  if (separator === -1) {
    return unauthorizedResponse();
  }

  const requestUsername = credentials.slice(0, separator);
  const requestPassword = credentials.slice(separator + 1);

  if (
    !safeEqual(requestUsername, username) ||
    !safeEqual(requestPassword, password)
  ) {
    return unauthorizedResponse();
  }

  return null;
}
