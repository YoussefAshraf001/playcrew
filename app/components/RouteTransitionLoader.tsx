"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

import { useUI } from "@/app/context/UIContext";

export default function RouteTransitionLoader() {
  const pathname = usePathname();
  const {
    routeLoading,
    startRouteLoading,
    stopRouteLoading,
    layoutTransitioning,
  } = useUI();

  const [phase, setPhase] = useState<"spinner" | "black">("spinner");

  useEffect(() => {
    let timer: number | undefined;
    if (layoutTransitioning) {
      setPhase("spinner");
      // after a short delay, transition to full black
      timer = window.setTimeout(() => setPhase("black"), 260);
    } else {
      // reset phase when not transitioning
      setPhase("spinner");
    }

    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [layoutTransitioning]);

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

  if (!routeLoading && !layoutTransitioning) return null;

  return (
    <AnimatePresence>
      {layoutTransitioning ? (
        <motion.div
          key="layout-transition"
          className="pointer-events-none fixed inset-0 z-120 overflow-hidden"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {phase === "spinner" ? (
            <motion.div
              className="fixed inset-0 z-120 flex items-center justify-center bg-black/30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <span className="loading loading-dots loading-xl text-cyan-300" />
            </motion.div>
          ) : (
            <motion.div
              className="fixed inset-0 z-120 bg-black"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28 }}
            />
          )}
        </motion.div>
      ) : (
        <motion.div
          key="route-transition"
          className="fixed inset-0 z-120 pointer-events-none flex items-center justify-center bg-black/45 backdrop-blur-[1px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <span className="loading loading-dots loading-xl text-cyan-300" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
