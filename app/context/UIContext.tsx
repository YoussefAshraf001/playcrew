"use client";

import { useUser } from "@/app/context/UserContext";
import {
  DEFAULT_NAVBAR_LAYOUT,
  isNavbarLayout,
  NAVBAR_LAYOUT_STORAGE_KEY,
  NavbarLayout,
  WHATS_NEW_SEEN_STORAGE_KEY,
} from "@/app/lib/uiPreferences";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

interface UIContextType {
  panelOpen: boolean;
  setPanelOpen: (v: boolean) => void;
  routeLoading: boolean;
  startRouteLoading: () => void;
  stopRouteLoading: () => void;
  layoutTransitioning: boolean;
  navbarLayout: NavbarLayout;
  setNavbarLayout: (layout: NavbarLayout) => Promise<void>;
  hasSeenWhatsNew: boolean;
  markWhatsNewSeen: () => Promise<void>;
}

const UIContext = createContext<UIContextType | null>(null);

export function UIProvider({ children }: { children: React.ReactNode }) {
  const { user, profile, setProfile, isAdmin } = useUser();
  const [panelOpen, setPanelOpen] = useState(false);
  const [routeLoading, setRouteLoading] = useState(false);
  const [layoutTransitioning, setLayoutTransitioning] = useState(false);
  const [navbarLayoutOverride, setNavbarLayoutOverride] =
    useState<NavbarLayout | null>(() => {
      if (typeof window === "undefined") return null;
      const storedLayout = window.localStorage.getItem(
        NAVBAR_LAYOUT_STORAGE_KEY,
      );
      return isNavbarLayout(storedLayout) ? storedLayout : null;
    });
  const [hasSeenWhatsNewOverride, setHasSeenWhatsNewOverride] = useState<
    boolean | null
  >(() => {
    if (typeof window === "undefined") return null;
    const storedValue = window.localStorage.getItem(WHATS_NEW_SEEN_STORAGE_KEY);
    return storedValue === null ? null : storedValue === "true";
  });
  const navbarLayout =
    navbarLayoutOverride ??
    (isNavbarLayout(profile?.navbarLayout)
      ? profile.navbarLayout
      : DEFAULT_NAVBAR_LAYOUT);
  const effectiveNavbarLayout =
    navbarLayout === "sidebar" && !isAdmin ? "top" : navbarLayout;
  const hasSeenWhatsNew =
    hasSeenWhatsNewOverride ??
    (typeof profile?.hasSeenWhatsNew === "boolean"
      ? profile.hasSeenWhatsNew
      : false);

  const startRouteLoading = useCallback(() => setRouteLoading(true), []);
  const stopRouteLoading = useCallback(() => setRouteLoading(false), []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const effectiveNavbarLayout =
      navbarLayout === "sidebar" && !isAdmin ? "top" : navbarLayout;

    document.documentElement.dataset.navbarLayout = effectiveNavbarLayout;
    window.localStorage.setItem(
      NAVBAR_LAYOUT_STORAGE_KEY,
      effectiveNavbarLayout,
    );
    window.localStorage.setItem(
      WHATS_NEW_SEEN_STORAGE_KEY,
      hasSeenWhatsNew ? "true" : "false",
    );
  }, [effectiveNavbarLayout, hasSeenWhatsNew, isAdmin, navbarLayout]);

  const persistProfile = useCallback(
    async (data: Record<string, unknown>) => {
      if (!user?.uid) return;

      setProfile((current) => (current ? { ...current, ...data } : current));
    },
    [setProfile, user],
  );

  const setNavbarLayout = useCallback(
    async (layout: NavbarLayout) => {
      if (layout === "sidebar" && !isAdmin) {
        setNavbarLayoutOverride("top");
        try {
          await persistProfile({ navbarLayout: "top" });
        } catch (error) {
          console.error("Failed to persist navbar layout:", error);
        }
        return;
      }

      if (layout === navbarLayout) return;

      setLayoutTransitioning(true);

      await new Promise((resolve) => window.setTimeout(resolve, 180));
      setNavbarLayoutOverride(layout);

      try {
        await persistProfile({ navbarLayout: layout });
      } catch (error) {
        console.error("Failed to persist navbar layout:", error);
      }

      await new Promise((resolve) => window.setTimeout(resolve, 300));
      setLayoutTransitioning(false);
    },
    [isAdmin, navbarLayout, persistProfile],
  );

  const markWhatsNewSeen = useCallback(async () => {
    if (hasSeenWhatsNew) return;

    setHasSeenWhatsNewOverride(true);

    try {
      await persistProfile({ hasSeenWhatsNew: true });
    } catch (error) {
      console.error("Failed to persist What's New state:", error);
    }
  }, [hasSeenWhatsNew, persistProfile]);

  return (
    <UIContext.Provider
      value={{
        panelOpen,
        setPanelOpen,
        routeLoading,
        startRouteLoading,
        stopRouteLoading,
        layoutTransitioning,
        navbarLayout: effectiveNavbarLayout,
        setNavbarLayout,
        hasSeenWhatsNew,
        markWhatsNewSeen,
      }}
    >
      {children}
    </UIContext.Provider>
  );
}

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error("useUI must be used inside UIProvider");
  return ctx;
}
