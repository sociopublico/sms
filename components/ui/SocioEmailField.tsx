import { fieldControlClass } from "@/components/ui/Field";

export function SocioEmailField({
  name = "local_part",
  defaultValue = "",
}: {
  name?: string;
  defaultValue?: string;
}) {
  return (
    <span className={`${fieldControlClass} flex items-center gap-0 p-0 focus-within:border-cyan`}>
      <input
        name={name}
        required
        autoComplete="username"
        placeholder="nombre"
        defaultValue={defaultValue}
        className="min-w-0 flex-1 !w-auto border-0 bg-transparent px-3 py-2 text-sm text-navy outline-none placeholder:text-muted"
      />
      <span className="shrink-0 pr-3 text-sm text-muted">@sociopublico.com</span>
    </span>
  );
}
