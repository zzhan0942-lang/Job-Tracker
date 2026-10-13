// Per-instance shared limit, deliberately independent of spoofable forwarded IPs.
// Serverless instances do not share memory: add hosting-layer rate limiting for
// a durable global limit. No credentials or request data are stored here.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
let windowStart = 0;
let attempts = 0;

export function loginRetryAfter(now = Date.now()) {
  if (now >= windowStart + WINDOW_MS || now < windowStart) {
    windowStart = now;
    attempts = 0;
  }
  if (attempts >= MAX_ATTEMPTS) return Math.max(1, Math.ceil((windowStart + WINDOW_MS - now) / 1000));
  attempts++;
  return null;
}
