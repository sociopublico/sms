"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const LINKS = [
  { href: "/carga", label: "Carga" },
  { href: "/timeline", label: "Timeline" },
  { href: "/proyectos", label: "Proyectos" },
  { href: "/personas", label: "Personas" },
  { href: "/roles", label: "Roles" },
  { href: "/tareas", label: "Tareas" },
];

export function AppShell({
  email,
  canWrite,
  children,
}: {
  email: string | null;
  canWrite: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="min-h-full bg-stone-50 text-stone-900">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-6 px-6 py-3">
          <div className="flex items-center gap-8">
            <Link href="/carga" className="text-sm font-semibold tracking-tight">
              Gestión Socio
            </Link>
            <nav className="flex gap-1">
              {LINKS.map((link) => {
                const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`rounded px-3 py-1.5 text-sm ${
                      active ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-stone-500">
            <span>{email}</span>
            {canWrite ? (
              <span className="rounded bg-stone-100 px-2 py-0.5 text-xs text-stone-700">edita</span>
            ) : (
              <span className="rounded bg-stone-100 px-2 py-0.5 text-xs text-stone-700">lectura</span>
            )}
            <button type="button" onClick={logout} className="text-stone-700 hover:underline">
              Salir
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] px-6 py-6">{children}</main>
    </div>
  );
}
