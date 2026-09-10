type Props = {
  status: string;
};

export default function StatusBadge({
  status,
}: Props) {
  const styles: Record<string, string> = {
    未投递:
      "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-300",

    已投递:
      "bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300",

    测评中:
      "bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-300",

    已测评:
      "bg-purple-50 text-purple-500 dark:bg-purple-950 dark:text-purple-300",

    笔试中:
      "bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-300",

    已笔试:
      "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-300",

    面试中:
      "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-300",

    已挂:
      "bg-red-50 text-red-500 dark:bg-red-950 dark:text-red-300",

    收到offer:
      "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300",
  };

  const className =
    styles[status] ||
    "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-300";

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium ${className}`}
    >
      {status === "收到offer"
        ? "收到 Offer"
        : status || "未设置"}
    </span>
  );
}
