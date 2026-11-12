import Link from "next/link";

export function PageNotice({
  kind,
  text,
  clearHref,
}: {
  kind: "ok" | "error";
  text: string;
  clearHref?: string;
}) {
  return (
    <div
      role="status"
      className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm text-ink ${
        kind === "ok" ? "border-green/30 bg-green/10" : "border-danger/30 bg-danger/10"
      }`}
    >
      <p>{text}</p>
      {clearHref ? (
        <Link href={clearHref} className="shrink-0 text-muted hover:text-navy" aria-label="Cerrar aviso">
          ×
        </Link>
      ) : null}
    </div>
  );
}

export function noticeFromSearchParams(params: {
  notice?: string;
  noticeKind?: string;
}): { kind: "ok" | "error"; text: string } | null {
  const text = params.notice?.trim();
  if (!text) return null;
  return {
    kind: params.noticeKind === "error" ? "error" : "ok",
    text,
  };
}
