import Link from "next/link";

export function FilterChips({
  items,
  size = "md",
}: {
  items: { href: string; label: string; active: boolean }[];
  size?: "sm" | "md";
}) {
  const compact = size === "sm";
  return (
    <div className={`flex flex-wrap ${compact ? "max-w-xl justify-end gap-1.5 text-sm" : "gap-2 text-base"}`}>
      {items.map((item) => (
        <Link
          key={item.href + item.label}
          href={item.href}
          className={`rounded-full ${compact ? "px-2.5 py-0.5" : "px-3.5 py-1"} ${
            item.active
              ? "bg-ink !text-white hover:!text-white"
              : "border border-line bg-paper !text-navy hover:!text-cyan"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
