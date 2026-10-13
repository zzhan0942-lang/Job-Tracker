import { isScreenshotMimeType, MAX_SCREENSHOT_BYTES } from "./job-screenshot";

export function screenshotFileError(file: Pick<File, "type" | "size">): string | null {
  if (!isScreenshotMimeType(file.type)) return "请上传 PNG、JPEG 或 WebP 图片。";
  if (file.size === 0 || file.size > MAX_SCREENSHOT_BYTES) return "请上传不超过 10MB 的有效图片。";
  return null;
}

export function clipboardScreenshot(data: Pick<DataTransfer, "items" | "files" | "getData">, editingText: boolean): File | null {
  // Never intercept text or rich-text paste into an editable field.
  if (editingText && (data.getData("text/plain") || data.getData("text/html"))) return null;
  for (const item of Array.from(data.items)) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) return file;
    }
  }
  return Array.from(data.files).find((file) => file.type.startsWith("image/")) ?? null;
}
