"use client";

import { useState } from "react";
import { motion } from "framer-motion";

function trimQuote(text: string, maxLength = 120) {
  return text.length > maxLength ? `${text.slice(0, maxLength).trim()}...` : text;
}

const QUOTES = [
  { quote: "We're more ghosts than people.", author: "Arthur Morgan" },
  { quote: "Revenge is a fool's game.", author: "Arthur Morgan" },
  {
    quote: "We can't change what's done. We can only move on.",
    author: "Arthur Morgan",
  },
  {
    quote: "When you're lost in the darkness, look for the light.",
    author: "The Last of Us",
  },
  {
    quote: "After all we've been through... everything I've done... it can't be for nothing.",
    author: "Ellie",
  },
  { quote: "We get dirty, and the world stays clean.", author: "Captain John Price" },
  { quote: "Bravo Six, Going Dark.", author: "Captain John Price" },
  {
    quote: "We fight not so that the world will remember us, but so there will be a world to remember.",
    author: "Captain John Price",
  },
  { quote: "It's not a lake. It's an ocean.", author: "Alan Wake" },
  { quote: "Nightmares exist outside of logic.", author: "Alan Wake" },
  {
    quote: "A writer is a light that reveals the world of his story.",
    author: "Alan Wake",
  },
  { quote: "Don't be sorry. Be better.", author: "Kratos" },
  { quote: "The cycle ends here.", author: "Kratos" },
  { quote: "We must be better than this.", author: "Kratos" },
  {
    quote: "Wake the fuck up, Samurai. We have a city to burn.",
    author: "Johnny Silverhand",
  },
  {
    quote: "You can't save the world, but you can save yourself.",
    author: "Cyberpunk 2077",
  },
  { quote: "A happy ending? For folks like us? Wrong city.", author: "Johnny Silverhand" },
  {
    quote: "Evil is evil. Lesser, greater, makes no difference.",
    author: "Geralt of Rivia",
  },
  {
    quote: "If I have to choose between one evil and another, I'd rather not choose at all.",
    author: "Geralt",
  },
  { quote: "A man chooses. A slave obeys.", author: "Andrew Ryan" },
  {
    quote: "We all make choices. But in the end, our choices make us.",
    author: "BioShock",
  },
  {
    quote: "Why did I move here? I guess it was the weather.",
    author: "Michael De Santa",
  },
  { quote: "Surviving is winning.", author: "GTA V" },
  {
    quote: "The strength to stand alone is the strength to make a stand.",
    author: "Aloy",
  },
  {
    quote: "No matter how dark the night, morning always comes.",
    author: "Final Fantasy",
  },
];

export default function GameQuote() {
  const [quoteIndex] = useState(() =>
    Math.floor(Math.random() * QUOTES.length),
  );
  const quote = QUOTES[quoteIndex] ?? QUOTES[0];
  const trimmed = trimQuote(quote.quote, 120);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="relative w-full overflow-hidden rounded-2xl border border-cyan-500/25 bg-zinc-950/80 p-5 text-center shadow-[0_16px_40px_rgba(0,0,0,0.45)] flex flex-col justify-center min-h-[150px]"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.14),transparent_60%)]" />
      <p className="relative italic text-zinc-200 text-center leading-relaxed text-[15px]">
        &quot;{trimmed}&quot;
      </p>
      <span className="relative mt-3 text-sm font-medium text-cyan-300">- {quote.author}</span>
    </motion.div>
  );
}
