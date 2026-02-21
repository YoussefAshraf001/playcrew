"use client";

import { createContext, useCallback, useContext, useState } from "react";

interface UIContextType {
  panelOpen: boolean;
  setPanelOpen: (v: boolean) => void;
  routeLoading: boolean;
  startRouteLoading: () => void;
  stopRouteLoading: () => void;
}

const UIContext = createContext<UIContextType | null>(null);

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [routeLoading, setRouteLoading] = useState(false);

  const startRouteLoading = useCallback(() => setRouteLoading(true), []);
  const stopRouteLoading = useCallback(() => setRouteLoading(false), []);

  return (
    <UIContext.Provider
      value={{
        panelOpen,
        setPanelOpen,
        routeLoading,
        startRouteLoading,
        stopRouteLoading,
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
