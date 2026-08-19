"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { logPageView } from "@/app/(app)/audit-actions";

export function AuditPageView() {
  const pathname = usePathname();
  const search = useSearchParams();
  const query = search.toString();

  useEffect(() => {
    const path = query ? `${pathname}?${query}` : pathname;
    void logPageView(path);
  }, [pathname, query]);

  return null;
}
