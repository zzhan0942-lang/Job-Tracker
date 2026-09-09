type Props = {
  status: string;
};

export default function StatusBadge({
  status,
}: Props) {
  const styles: Record<string, string> = {
    未投递:
      "bg-neutral-100 text-neutral-500",

    已投递:
      "bg-slate-100 text-slate-600",

    测评中:
      "bg-violet-100 text-violet-600",

    已测评:
      "bg-purple-50 text-purple-500",

    笔试中:
      "bg-orange-100 text-orange-600",

    已笔试:
      "bg-amber-50 text-amber-600",

    面试中:
      "bg-blue-100 text-blue-600",

    已挂:
      "bg-red-50 text-red-500",

    收到offer:
      "bg-emerald-100 text-emerald-600",
  };

  const className =
    styles[status] ||
    "bg-neutral-100 text-neutral-500";

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