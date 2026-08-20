"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BrandMark } from "@/components/BrandMark";
import { AngleIcon } from "@/components/ui/AngleIcon";

type NavItem = { href: string; label: string };
type NavGroup = { id: string; label: string; items: NavItem[] };

function buildNav({ canWrite, isAdmin }: { canWrite: boolean; isAdmin: boolean }): NavGroup[] {
  const proyectos: NavItem[] = [{ href: "/proyectos", label: "Lista de proyectos" }];
  if (canWrite) proyectos.push({ href: "/proyectos/nuevo", label: "Crear nuevo proyecto" });

  const personasItems: NavItem[] = [
    { href: "/personas", label: "Personas" },
    { href: "/carga", label: "Workload" },
  ];
  if (canWrite) {
    personasItems.push({ href: "/tareas", label: "Tareas" }, { href: "/roles", label: "Roles" });
  }

  const groups: NavGroup[] = [
    { id: "proyectos", label: "Proyectos", items: proyectos },
    { id: "timeline", label: "Timeline", items: [{ href: "/timeline", label: "Timeline" }] },
    { id: "personas", label: "Personas", items: personasItems },
  ];

  if (canWrite) {
    groups.push({
      id: "horas",
      label: "Horas",
      items: [
        { href: "/horas", label: "Tabla de horas" },
        { href: "/horas/sync", label: "Sync de horas" },
      ],
    });
  }

  if (isAdmin) {
    groups.push({
      id: "admin",
      label: "Admin",
      items: [
        { href: "/usuarios", label: "Usuarios" },
        { href: "/log", label: "Logs" },
      ],
    });
  }

  return groups;
}

function pathActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function groupActive(pathname: string, items: NavItem[]) {
  return items.some((item) => pathActive(pathname, item.href));
}

function NavDropdown({
  group,
  onNavigate,
}: {
  group: NavGroup;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const active = groupActive(pathname, group.items);
  const single = group.items.length === 1 ? group.items[0] : null;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (single) {
    return (
      <Link
        href={single.href}
        onClick={onNavigate}
        className={`px-1 py-1 text-base transition-colors ${
          pathActive(pathname, single.href)
            ? "font-medium text-cyan hover:text-cyan"
            : "text-navy hover:text-cyan"
        }`}
      >
        {group.label}
      </Link>
    );
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex items-center gap-1 px-1 py-1 text-base transition-colors ${
          active || open ? "font-medium text-cyan hover:text-cyan" : "text-navy hover:text-cyan"
        }`}
      >
        {group.label}
        <AngleIcon direction={open ? "up" : "down"} className="opacity-70" />
      </button>
      {open ? (
        <div
          id={menuId}
          className="absolute left-0 top-full z-50 mt-2 min-w-52 rounded-xl border border-line bg-white p-1.5 shadow-sm"
        >
          {group.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => {
                setOpen(false);
                onNavigate?.();
              }}
              className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                pathActive(pathname, item.href)
                  ? "bg-canvas font-medium text-cyan"
                  : "text-navy hover:bg-canvas hover:text-cyan"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MobileGroup({
  group,
  onNavigate,
}: {
  group: NavGroup;
  onNavigate: () => void;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(groupActive(pathname, group.items));
  const single = group.items.length === 1 ? group.items[0] : null;

  if (single) {
    return (
      <Link
        href={single.href}
        onClick={onNavigate}
        className={`px-1 py-1 text-base ${
          pathActive(pathname, single.href) ? "font-medium text-cyan" : "text-navy"
        }`}
      >
        {group.label}
      </Link>
    );
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`flex w-full items-center justify-between px-1 py-1 text-left text-base ${
          groupActive(pathname, group.items) ? "font-medium text-cyan" : "text-navy"
        }`}
      >
        {group.label}
        <AngleIcon direction={open ? "up" : "down"} className="opacity-70" />
      </button>
      {open ? (
        <div className="ml-3 flex flex-col gap-1 border-l border-line pl-3">
          {group.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`py-1 text-sm ${
                pathActive(pathname, item.href) ? "font-medium text-cyan" : "text-navy"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function AppShell({
  displayName,
  canWrite,
  isAdmin,
  children,
}: {
  displayName: string;
  canWrite: boolean;
  isAdmin: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const nav = buildNav({ canWrite, isAdmin });

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
              {nav.map((group) => (
                <NavDropdown key={group.id} group={group} />
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted">
            <span className="hidden max-w-48 truncate sm:inline">{displayName}</span>
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
            {nav.map((group) => (
              <MobileGroup key={group.id} group={group} onNavigate={() => setOpen(false)} />
            ))}
          </nav>
        ) : null}
      </header>
      <main className="w-full px-6 py-8">{children}</main>
    </div>
  );
}
