import type { ReactNode } from "react";

export function PageHeader({
  kicker,
  title,
  description,
  actions,
  titleClassName = "",
}: {
  kicker?: ReactNode;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  titleClassName?: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {kicker ? <div className="text-sm text-muted">{kicker}</div> : null}
        <h1
          className={`text-[1.75rem] leading-tight tracking-tight text-ink ${titleClassName || "font-medium"}`.trim()}
        >
          {title}
        </h1>
        {description ? <div className="mt-1 max-w-2xl text-sm text-muted">{description}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
