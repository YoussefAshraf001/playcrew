import { motion } from "framer-motion";
import { GiAbdominalArmor } from "react-icons/gi";
import { LuCalendarClock } from "react-icons/lu";
import { MdExplore } from "react-icons/md";
import { PiArrowFatLinesUpDuotone } from "react-icons/pi";
import { SlGameController } from "react-icons/sl";

interface AboutPanelProps {
  containerVariants: any;
  itemVariants: any;
}

export default function AboutPanel({
  containerVariants,
  itemVariants,
}: AboutPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 100 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{
        opacity: 0,
        y: 120,
        transition: {
          duration: 0.4,
          ease: [0.22, 1, 0.36, 1],
        },
      }}
      transition={{
        duration: 0.45,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="relative rounded-2xl border border-white/10 px-12 py-10"
    >
      {/* ───────── BACKGROUND BLUR LAYER ───────── */}
      <div className="absolute inset-0 rounded-2xl bg-black/40 backdrop-blur-sm" />

      {/* ───────── CONTENT LAYER ───────── */}
      <div className="relative z-10">
        <h3 className="uppercase text-xs tracking-[0.45em] text-zinc-300 mb-10 text-center">
          About PlayCrew
        </h3>

        <motion.ul
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="
            space-y-6
            max-w-3xl mx-auto
            min-h-[400px]
            flex flex-col justify-center
          "
        >
          {[
            {
              icon: <MdExplore />,
              title: "Explore",
              desc: "Discover upcoming and trending games to expand your collection.",
            },
            {
              icon: <SlGameController />,
              title: "Track Games",
              desc: "Build your PlayCrew with games you play or plan to play.",
            },
            {
              icon: <LuCalendarClock />,
              title: "Release Radar",
              desc: "Follow upcoming releases and earn XP by tracking them.",
            },
            {
              icon: <GiAbdominalArmor />,
              title: "Earn XP",
              desc: "Playtime and game status directly affect your progression.",
            },
            {
              icon: <PiArrowFatLinesUpDuotone />,
              title: "Level Up",
              desc: "Turn habits into long-term stats and progression.",
            },
          ].map((item) => (
            <motion.li
              key={item.title}
              variants={itemVariants}
              className="flex items-start gap-6"
            >
              <div className="text-cyan-400 text-xl mt-1 shrink-0">
                {item.icon}
              </div>

              <div>
                <p className="text-lg text-zinc-100">{item.title}</p>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </motion.div>
  );
}
