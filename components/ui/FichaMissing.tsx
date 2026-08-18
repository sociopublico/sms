import Link from "next/link";
import { HoverTip } from "@/components/ui/HoverTip";

export function missingFicha(fichaUrl: string | null | undefined, code?: string | null) {
  return !fichaUrl || (code?.startsWith("SIN-FICHA-") ?? false);
}

export function FichaMissing({ href }: { href?: string }) {
  const mark = (
    <HoverTip content="No tiene ficha">
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-danger text-[12px] font-medium lowercase leading-none text-white">
        i
      </span>
    </HoverTip>
  );
  if (!href) return mark;
  return (
    <Link href={href} className="inline-flex hover:opacity-80">
      {mark}
    </Link>
  );
}
