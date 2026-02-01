"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";

const QUOTES = [
  // ───── Red Dead Redemption 2 ─────
  { quote: "We’re more ghosts than people.", author: "Arthur Morgan" },
  { quote: "Revenge is a fool’s game.", author: "Arthur Morgan" },
  { quote: "I gave you all I had.", author: "Arthur Morgan" },
  {
    quote: "We can’t change what’s done. We can only move on.",
    author: "Arthur Morgan",
  },

  // ───── The Last of Us ─────
  {
    quote: "When you’re lost in the darkness, look for the light.",
    author: "The Last of Us",
  },
  { quote: "You have no idea what loss is.", author: "Joel" },
  { quote: "It can’t be for nothing.", author: "The Last of Us" },
  {
    quote:
      "After all we’ve been through… everything I’ve done… it can’t be for nothing.",
    author: "Ellie",
  },

  // ───── Call of Duty ─────
  {
    quote: "We get dirty, and the world stays clean.",
    author: "Captain Price",
  },
  { quote: "The rules have changed.", author: "Captain Price" },
  { quote: "You can’t kill an idea.", author: "Call of Duty" },

  // ───── Alan Wake ─────
  { quote: "It’s not a lake. It’s an ocean.", author: "Alan Wake" },
  { quote: "Nightmares exist outside of logic.", author: "Alan Wake" },
  {
    quote: "A writer is a light that reveals the world of his story.",
    author: "Alan Wake",
  },

  // ───── God of War ─────
  { quote: "Don’t be sorry. Be better.", author: "Kratos" },
  { quote: "The cycle ends here.", author: "Kratos" },
  { quote: "We must be better than this.", author: "Kratos" },

  // ───── Cyberpunk 2077 ─────
  {
    quote: "Wake the fuck up, Samurai. We have a city to burn.",
    author: "Johnny Silverhand",
  },
  {
    quote: "You can’t save the world, but you can save yourself.",
    author: "Cyberpunk 2077",
  },
  {
    quote: "A happy ending? For folks like us? Wrong city.",
    author: "Johnny Silverhand",
  },

  // ───── The Witcher 3 ─────
  {
    quote: "Evil is evil. Lesser, greater — makes no difference.",
    author: "Geralt of Rivia",
  },
  {
    quote: "Sometimes the best thing a flower can do is die.",
    author: "Geralt of Rivia",
  },
  {
    quote:
      "If I have to choose between one evil and another, I’d rather not choose at all.",
    author: "Geralt",
  },

  // ───── Mass Effect ─────
  {
    quote:
      "Stand in the ashes of a trillion dead souls and ask if honor matters.",
    author: "Javik",
  },
  { quote: "Does this unit have a soul?", author: "Legion" },
  {
    quote:
      "I’m Commander Shepard, and this is my favorite store on the Citadel.",
    author: "Shepard",
  },

  // ───── Fallout ─────
  { quote: "War. War never changes.", author: "Fallout" },
  {
    quote: "Finding it isn’t the hard part. It’s letting go.",
    author: "Fallout",
  },

  // ───── BioShock ─────
  { quote: "A man chooses. A slave obeys.", author: "Andrew Ryan" },
  {
    quote: "We all make choices. But in the end, our choices make us.",
    author: "BioShock",
  },

  // ───── Metal Gear Solid ─────
  { quote: "War has changed.", author: "Solid Snake" },
  { quote: "The world would be better off without snakes.", author: "MGS" },

  // ───── Assassin’s Creed ─────
  {
    quote: "Nothing is true. Everything is permitted.",
    author: "Assassin’s Creed",
  },
  { quote: "Requiescat in pace.", author: "Ezio Auditore" },

  // ───── Dark Souls / Elden Ring ─────
  { quote: "You died.", author: "Dark Souls" },
  {
    quote: "The fire fades… and the lords go without thrones.",
    author: "Dark Souls",
  },
  { quote: "Put these foolish ambitions to rest.", author: "Elden Ring" },

  // ───── Halo ─────
  { quote: "I need a weapon.", author: "Master Chief" },
  { quote: "Finish the fight.", author: "Halo" },

  // ───── GTA ─────
  {
    quote: "Why did I move here? I guess it was the weather.",
    author: "Michael De Santa",
  },
  { quote: "Surviving is winning.", author: "GTA V" },

  // ───── Horizon ─────
  {
    quote: "The strength to stand alone is the strength to make a stand.",
    author: "Aloy",
  },

  // ───── Control ─────
  { quote: "You are a worm through time.", author: "Control" },

  // ───── Metro ─────
  { quote: "If it’s hostile, you kill it.", author: "Metro 2033" },

  // ───── Final Fantasy ─────
  {
    quote: "No matter how dark the night, morning always comes.",
    author: "Final Fantasy",
  },

  // ───── Doom ─────
  { quote: "Rip and tear, until it is done.", author: "DOOM" },
];

export default function GameQuote() {
  const quote = useMemo(() => {
    return QUOTES[Math.floor(Math.random() * QUOTES.length)];
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="w-full rounded-xl border border-zinc-700 bg-zinc-900/80 p-5 text-center shadow-lg flex flex-col justify-center min-h-[140px]"
    >
      <p className="italic text-zinc-300 text-center leading-relaxed">
        “{quote.quote}”
      </p>
      <span className="mt-3 text-sm text-cyan-400">— {quote.author}</span>
    </motion.div>
  );
}
