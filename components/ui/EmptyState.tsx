import { Button } from "@/components/ui/Button";

export function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-paper px-4 py-8 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      {actionHref && actionLabel ? (
        <Button href={actionHref} variant="ghost" className="mt-4 !px-3 !py-1.5 !text-xs">
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
