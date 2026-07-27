"use client";

import { usePersistLastPage } from "../hooks/usePersistLastPage";

export default function ClientOnlyHooks() {
  usePersistLastPage();
  return null;
}
