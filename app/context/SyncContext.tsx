"use client";

import { createContext, useContext, useState } from "react";

type SyncContextType = {
  isSyncingReleaseDates: boolean;
  setIsSyncingReleaseDates: (value: boolean) => void;

  syncCurrent: number;
  setSyncCurrent: (value: number) => void;

  syncTotal: number;
  setSyncTotal: (value: number) => void;

  currentGameName: string;
  setCurrentGameName: (value: string) => void;

  releaseSyncRequest: number;
  requestReleaseSync: () => void;
};

const SyncContext = createContext<SyncContextType | null>(null);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [isSyncingReleaseDates, setIsSyncingReleaseDates] = useState(false);
  const [syncCurrent, setSyncCurrent] = useState(0);
  const [syncTotal, setSyncTotal] = useState(0);
  const [currentGameName, setCurrentGameName] = useState("");
  const [releaseSyncRequest, setReleaseSyncRequest] = useState(0);

  return (
    <SyncContext.Provider
      value={{
        isSyncingReleaseDates,
        setIsSyncingReleaseDates,

        syncCurrent,
        setSyncCurrent,

        syncTotal,
        setSyncTotal,

        currentGameName,
        setCurrentGameName,

        releaseSyncRequest,
        requestReleaseSync: () => setReleaseSyncRequest((value) => value + 1),
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const context = useContext(SyncContext);

  if (!context) {
    throw new Error("useSync must be used inside SyncProvider");
  }

  return context;
}
