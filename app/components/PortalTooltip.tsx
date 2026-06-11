"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

interface PortalTooltipProps {
  anchorRect: DOMRect | null;
  text: string;
  visible: boolean;
}

export default function PortalTooltip({
  anchorRect,
  text,
  visible,
}: PortalTooltipProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !visible || !anchorRect) {
    return null;
  }

  return createPortal(
    <div
      className="
        fixed
        z-[99999]
        w-52
        rounded-xl
        border border-amber-400/20
        bg-zinc-950/95
        px-3
        py-2
        text-xs
        text-zinc-200
        shadow-xl
        backdrop-blur-md
      "
      style={{
        top: anchorRect.bottom + 8,
        left: anchorRect.left,
      }}
    >
      {text}
    </div>,
    document.body,
  );
}