"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const BLOCKED_ROUTES = ["/", "/menu", "/auth", "/dashboard"];

export function usePersistLastPage() {
  const pathname = usePathname();
  const hasHydrated = useRef(false);

  useEffect(() => {
    if (!hasHydrated.current) {
      hasHydrated.current = true;
      return;
    }

    if (!BLOCKED_ROUTES.includes(pathname)) {
      localStorage.setItem("lastPage", pathname);
    }
  }, [pathname]);
}
