"use client";

import { createContext, useContext, useState } from "react";

type AuthMode = "login" | "signup" | null;

const AuthModalContext = createContext<{
  mode: AuthMode;
  open: (mode: AuthMode) => void;
  close: () => void;
}>({
  mode: null,
  open: () => {},
  close: () => {},
});

export function AuthModalProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<AuthMode>(null);

  return (
    <AuthModalContext.Provider
      value={{
        mode,
        open: setMode,
        close: () => setMode(null),
      }}
    >
      {children}
    </AuthModalContext.Provider>
  );
}

export const useAuthModal = () => useContext(AuthModalContext);
