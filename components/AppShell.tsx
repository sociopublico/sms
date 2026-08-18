"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BrandMark } from "@/components/BrandMark";
import { Badge } from "@/components/ui/Badge";

const OPERATIONS = [
  { href: "/timeline", label: "Timeline" },
  { href: "/carga", label: "Workload" },
  { href: "/proyectos", label: "Proyectos" },
];

const CATALOG = [
  { href: "/personas", label: "Personas" },
  { href: "/roles", label: "Roles" },
  { href: "/tareas", label: "Tareas" },
];

function NavLink({
  href,
  label,
  onClick,
}: {
  href: string;
  label: string;
  onClick?: () => void;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`px-1 py-1 text-base transition-colors ${
        active ? "font-medium text-cyan hover:text-cyan" : "text-navy hover:text-cyan"
      }`}
    >
      {label}
    </Link>
  );
}

export function AppShell({
  email,
  canWrite,
  isAdmin,
  children,
}: {
  email: string | null;
  canWrite: boolean;
  isAdmin: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const catalog = isAdmin ? [...CATALOG, { href: "/usuarios", label: "Usuarios" }] : CATALOG;

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="min-h-full bg-canvas text-navy">
      <header className="sticky top-0 z-[100] h-16 border-b border-line bg-white">
        <div className="flex h-full w-full items-center justify-between gap-6 px-6">
          <div className="flex min-w-0 items-center gap-8">
            <Link href="/timeline" className="flex min-w-0 items-center gap-2 text-navy hover:text-navy">
              <BrandMark className="h-8 w-8 shrink-0" />
              <span className="truncate text-base font-medium tracking-tight text-ink">
                Socio Management System
              </span>
            </Link>
            <nav className="hidden items-center gap-5 xl:flex">
              {OPERATIONS.map((link) => (
                <NavLink key={link.href} {...link} />
              ))}
              <span className="h-4 w-px bg-line" aria-hidden />
              {catalog.map((link) => (
                <NavLink key={link.href} {...link} />
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted">
            <span className="hidden max-w-48 truncate sm:inline">{email}</span>
            <Badge status={canWrite ? "edita" : "lectura"}>{canWrite ? "edita" : "lectura"}</Badge>
            <button type="button" onClick={logout} className="text-navy hover:text-cyan">
              Salir
            </button>
            <button
              type="button"
              className="flex h-9 w-9 flex-col items-center justify-center gap-1.5 xl:hidden"
              aria-label="Abrir menú"
              onClick={() => setOpen((value) => !value)}
            >
              <span className="block h-px w-5 bg-navy" />
              <span className="block h-px w-5 bg-navy" />
              <span className="block h-px w-5 bg-navy" />
            </button>
          </div>
        </div>
        {open ? (
          <nav className="flex flex-col gap-2 border-t border-line bg-paper px-6 py-4 xl:hidden">
            {[...OPERATIONS, ...catalog].map((link) => (
              <NavLink key={link.href} {...link} onClick={() => setOpen(false)} />
            ))}
          </nav>
        ) : null}
      </header>
      <main className="w-full px-6 py-8">{children}</main>
    </div>
  );
}
