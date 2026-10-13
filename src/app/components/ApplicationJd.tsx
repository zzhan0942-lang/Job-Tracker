"use client";

import { useEffect, useId, useRef, useState } from "react";

type Props = {
  jd?: string | null;
};

export default function ApplicationJd({ jd }: Props) {
  const id = useId();
  const textRef = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [expandable, setExpandable] = useState(false);

  useEffect(() => {
    const text = textRef.current;
    if (!text) return;

    // Measure rendered lines, including wrapping on mobile. The complete JD
    // stays in the DOM; clamping only changes the visual presentation.
    const measure = () => {
      const lineHeight = parseFloat(window.getComputedStyle(text).lineHeight);
      setExpandable(text.scrollHeight > lineHeight * 10 + 1);
    };
    const frame = window.requestAnimationFrame(measure);
    const observer = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(measure);
    observer?.observe(text);
    window.addEventListener("resize", measure);

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [jd]);

  if (!jd?.trim()) return null;

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="mb-6 w-full min-w-0 overflow-hidden rounded-[22px] border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-[#171719] sm:mb-8 sm:rounded-[30px] sm:p-7"
    >
      <h2 id={`${id}-title`} className="text-xl font-semibold sm:text-2xl">
        JD / 职位描述
      </h2>
      <p
        ref={textRef}
        id={`${id}-text`}
        className={`mt-4 min-w-0 whitespace-pre-wrap text-sm leading-[1.7] text-neutral-600 [overflow-wrap:anywhere] dark:text-neutral-300 sm:text-[15px] ${expanded ? "" : "line-clamp-[10]"}`}
      >
        {jd}
      </p>
      {expandable && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={`${id}-text`}
          onClick={() => setExpanded((value) => !value)}
          className="mt-3 min-h-11 rounded-full border border-neutral-200 px-4 py-2 text-sm text-neutral-600 transition hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          {expanded ? "收起" : "展开全文"}
        </button>
      )}
    </section>
  );
}
