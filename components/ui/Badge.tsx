const STYLES: Record<string, string> = {
  en_curso: "bg-green/15 text-ink",
  pausado: "bg-canvas text-muted",
  mantenimiento: "bg-cyan/10 text-cyan",
  finalizado: "bg-ink text-white",
  edita: "bg-green/15 text-ink",
  lectura: "bg-canvas text-muted",
  interno: "bg-canvas text-muted",
  cliente: "bg-blue/10 text-navy",
};

export function Badge({
  status,
  children,
  className = "",
}: {
  status?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const tone = STYLES[status ?? ""] ?? "bg-canvas text-muted";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium ${tone} ${className}`.trim()}
    >
      {children}
    </span>
  );
}
