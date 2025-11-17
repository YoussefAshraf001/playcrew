"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";

interface CollapsiblePanelProps {
  title: string;
  children: ReactNode;
  collapsed?: boolean;
  setCollapsed?: (collapsed: boolean) => void;
  defaultWidth?: number; // expanded width
  collapsedWidth?: number; // collapsed width
}

export default function CollapsiblePanel({
  title,
  children,
  collapsed = false,
  setCollapsed,
  defaultWidth = 320,
  collapsedWidth = 56,
}: CollapsiblePanelProps) {
  return (
    <motion.div
      className="bg-[#111] rounded-lg shadow-lg overflow-hidden flex flex-col"
      animate={{ width: collapsed ? collapsedWidth : defaultWidth }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-700">
        <span
          className={`text-white font-semibold text-sm truncate ${
            collapsed ? "hidden" : "block"
          }`}
        >
          {title}
        </span>

        {setCollapsed && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 rounded hover:bg-zinc-600 text-white"
          >
            {collapsed ? "▶" : "◀"}
          </button>
        )}
      </div>

      {/* Content */}
      <motion.div
        className="flex-1 overflow-hidden"
        initial={{ opacity: 1 }}
        animate={{ opacity: collapsed ? 0 : 1 }}
        transition={{ duration: 0.2 }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
