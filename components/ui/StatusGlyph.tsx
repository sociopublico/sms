import { STATUS_LABEL } from "@/lib/dates";

export function StatusGlyph({
  status,
  className = "",
  title,
}: {
  status: string;
  className?: string;
  title?: boolean;
}) {
  const label = STATUS_LABEL[status] ?? status;
  const tone =
    status === "en_curso" ? "text-green" : status === "mantenimiento" ? "text-cyan" : "text-muted";

  return (
    <span
      className={`inline-flex ${tone} ${className}`.trim()}
      aria-label={label}
      title={title === false ? undefined : label}
    >
      {status === "en_curso" ? (
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
          <path d="M8 5.5v13l12-6.5-12-6.5z" />
        </svg>
      ) : status === "pausado" ? (
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
          <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />
        </svg>
      ) : status === "mantenimiento" ? (
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
          <path d="M12 6V2L7 7l5 5V8c2.76 0 5 2.24 5 5a5 5 0 1 1-9.9-1.13l-1.84-.78A7 7 0 1 0 12 6z" />
        </svg>
      ) : (
        <span className="h-2 w-2 rounded-full bg-current" />
      )}
    </span>
  );
}
