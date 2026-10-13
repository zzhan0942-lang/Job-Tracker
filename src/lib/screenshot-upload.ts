import { MAX_SCREENSHOT_BYTES, type ScreenshotMimeType } from "./job-screenshot";

export class ScreenshotUploadError extends Error {
  constructor(public readonly status: number) {
    super("Invalid screenshot upload");
  }
}

export async function readScreenshotBody(request: Request): Promise<Uint8Array> {
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_SCREENSHOT_BYTES)) {
    throw new ScreenshotUploadError(413);
  }
  if (!request.body) throw new ScreenshotUploadError(400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_SCREENSHOT_BYTES) {
        await reader.cancel();
        throw new ScreenshotUploadError(413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (total === 0) throw new ScreenshotUploadError(400);
  return Buffer.concat(chunks);
}

// Reject mislabeled non-images before sending anything to the provider.
export function matchesImageSignature(image: Uint8Array, mimeType: ScreenshotMimeType) {
  if (mimeType === "image/png") {
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];
    return image.length >= 24 && signature.every((byte, index) => image[index] === byte)
      && Buffer.from(image.subarray(12, 16)).toString("ascii") === "IHDR";
  }
  if (mimeType === "image/jpeg") {
    return image.length >= 4 && image[0] === 255 && image[1] === 216 && image[2] === 255;
  }
  return image.length >= 12
    && Buffer.from(image.subarray(0, 4)).toString("ascii") === "RIFF"
    && Buffer.from(image.subarray(8, 12)).toString("ascii") === "WEBP";
}
