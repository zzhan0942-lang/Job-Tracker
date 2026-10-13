import { type ParsedJobScreenshot } from "./job-screenshot";

export function getLocalToday(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

// Defaults belong to the editable form, never to the AI's factual response.
export function jobScreenshotPrefill(job: ParsedJobScreenshot, now = new Date()) {
  return {
    company: job.company ?? "",
    role: job.position ?? "",
    base: job.base ?? "",
    status: job.status ?? "已投递",
    date: job.applicationDate ?? getLocalToday(now),
    url: job.officialUrl ?? "",
    jobDescription: job.jobDescription ?? "",
  };
}
