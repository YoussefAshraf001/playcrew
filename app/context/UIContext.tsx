"use client";

import { createContext, useContext, useState } from "react";

interface UIContextType {
  panelOpen: boolean;
  setPanelOpen: (v: boolean) => void;
}

const UIContext = createContext<UIContextType | null>(null);

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [panelOpen, setPanelOpen] = useState(false);

  return (
    <UIContext.Provider value={{ panelOpen, setPanelOpen }}>
      {children}
    </UIContext.Provider>
  );
}

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error("useUI must be used inside UIProvider");
  return ctx;
}
