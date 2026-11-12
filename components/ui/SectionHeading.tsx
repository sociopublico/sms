export function SectionHeading({
  title,
  count,
  hint,
}: {
  title: string;
  count?: number;
  hint?: string;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="text-lg font-medium tracking-tight text-ink">{title}</h2>
        {typeof count === "number" ? (
          <span className="text-xs font-medium tabular-nums text-muted">{count}</span>
        ) : null}
      </div>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
