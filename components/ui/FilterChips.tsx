import Link from "next/link";

export function FilterChips({
  items,
}: {
  items: { href: string; label: string; active: boolean }[];
}) {
  return (
    <div className="flex flex-wrap gap-2 text-base">
      {items.map((item) => (
        <Link
          key={item.href + item.label}
          href={item.href}
          className={`rounded-full px-3.5 py-1 ${
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
