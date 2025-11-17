import { motion } from "framer-motion";
import { useState } from "react";
import { MdMusicOff, MdMusicNote } from "react-icons/md";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";

export default function ButtonRow({
  collapsed,
  isMuted,
  toggleMute,
  setCollapsed,
}) {
  const [hover, setHover] = useState<"mute" | "collapse" | null>(null);

  return (
    <div
      className={`${
        collapsed ? "flex flex-col" : "flex"
      } w-full justify-center gap-2`}
    >
      {/* Mute Button */}
      <motion.button
        onClick={toggleMute}
        onHoverStart={() => !collapsed && setHover("mute")}
        onHoverEnd={() => setHover(null)}
        animate={{
          scale: collapsed ? 1.1 : hover === "mute" ? 1.25 : 1,
        }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className={`
          p-3 rounded-xl flex items-center justify-center
          ${
            isMuted
              ? "border-2 border-zinc-500 hover:bg-zinc-600"
              : "border-2 border-cyan-600 hover:bg-cyan-600"
          }
        `}
      >
        {isMuted ? (
          <MdMusicOff className="text-xl" />
        ) : (
          <MdMusicNote className="text-xl" />
        )}
      </motion.button>

      {/* Collapse Button */}
      <motion.button
        onClick={() => setCollapsed(!collapsed)}
        onHoverStart={() => !collapsed && setHover("collapse")}
        onHoverEnd={() => setHover(null)}
        animate={{
          scale: collapsed ? 1.1 : hover === "collapse" ? 1.25 : 1,
          x: !collapsed && hover === "mute" ? 10 : 0, // <-- Move when mute is hovered
        }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="p-3 rounded-xl flex items-center justify-center border-2 border-cyan-600 hover:bg-cyan-600"
      >
        {collapsed ? (
          <FaChevronRight className="text-xl" />
        ) : (
          <FaChevronLeft className="text-xl" />
        )}
      </motion.button>
    </div>
  );
}
