import { requireApiAuth } from "@/lib/api-auth";
import { recognizeJobScreenshot, ScreenshotRecognitionError } from "@/lib/deepseek";
import { isScreenshotMimeType, SCREENSHOT_ERROR } from "@/lib/job-screenshot";
import { matchesImageSignature, readScreenshotBody, ScreenshotUploadError } from "@/lib/screenshot-upload";

export const runtime = "nodejs";
export const maxDuration = 60;

function failure(status: number) {
  return Response.json({ success: false, error: SCREENSHOT_ERROR }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  const authError = await requireApiAuth(request);
  if (authError) return authError;

  const mimeType = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!isScreenshotMimeType(mimeType)) return failure(415);

  try {
    const image = await readScreenshotBody(request);
    if (!matchesImageSignature(image, mimeType)) return failure(415);
    const job = await recognizeJobScreenshot(image, mimeType);
    return Response.json({ success: true, job }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ScreenshotUploadError) return failure(error.status);
    if (error instanceof ScreenshotRecognitionError && error.issues.length > 0) {
      console.warn("AI response validation failed", { issues: error.issues });
    }
    // Codes only: never log screenshot bytes, model output, keys, or raw errors.
    const code = error instanceof ScreenshotRecognitionError ? error.code : "request_failed";
    console.error("Job screenshot recognition failed", { code });
    return failure(code === "missing_key" ? 503 : code === "timeout" ? 504 : 502);
  }
}
