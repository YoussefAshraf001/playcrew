"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";

import { useUI } from "@/app/context/UIContext";

export default function RouteTransitionLoader() {
  const pathname = usePathname();
  const { routeLoading, startRouteLoading, stopRouteLoading } = useUI();

  useEffect(() => {
    stopRouteLoading();
  }, [pathname, stopRouteLoading]);

  useEffect(() => {
    if (!routeLoading) return;

    const timeout = setTimeout(() => {
      stopRouteLoading();
    }, 15000);

    return () => clearTimeout(timeout);
  }, [routeLoading, stopRouteLoading]);

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;

      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      if (href.startsWith("mailto:") || href.startsWith("tel:")) return;

      const nextUrl = new URL(anchor.href, window.location.href);
      const currentUrl = new URL(window.location.href);

      if (nextUrl.origin !== currentUrl.origin) return;
      if (
        nextUrl.pathname === currentUrl.pathname &&
        nextUrl.search === currentUrl.search &&
        nextUrl.hash === currentUrl.hash
      ) {
        return;
      }

      startRouteLoading();
    };

    document.addEventListener("click", onDocumentClick, true);
    return () => {
      document.removeEventListener("click", onDocumentClick, true);
    };
  }, [startRouteLoading]);

  if (!routeLoading) return null;

  return (
    <div className="fixed inset-0 z-[120] pointer-events-none flex items-center justify-center bg-black/45 backdrop-blur-[1px]">
      <motion.div
        className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full"
        animate={{ rotate: 360 }}
        transition={{
          repeat: Infinity,
          ease: "linear",
          duration: 1,
        }}
      />
    </div>
  );
}
