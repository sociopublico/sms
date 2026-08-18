export function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block text-sm text-navy ${className}`.trim()}>
      <span className="mb-1 block font-medium">{label}</span>
      <span className="block w-full [&_input]:w-full [&_select]:w-full [&_textarea]:w-full">
        {children}
      </span>
    </label>
  );
}

export const fieldControlClass =
  "rounded-xl border border-line bg-paper px-3 py-2 text-sm text-navy placeholder:text-muted focus:border-cyan";
