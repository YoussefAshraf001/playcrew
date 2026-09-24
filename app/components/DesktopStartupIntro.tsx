"use client";

import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { useEffect, useState } from "react";
import styles from "./DesktopStartupIntro.module.css";

const PLAYED_KEY = "playcrew-desktop-intro-played";

export default function DesktopStartupIntro() {
  const reduceMotion = useReducedMotion();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!window.playcrewDesktop || sessionStorage.getItem(PLAYED_KEY)) return;

    const showTimer = window.setTimeout(() => {
      sessionStorage.setItem(PLAYED_KEY, "true");
      setVisible(true);
    }, 0);
    const timer = window.setTimeout(
      () => setVisible(false),
      reduceMotion ? 350 : 7050,
    );
    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(timer);
    };
  }, [reduceMotion]);

  if (!visible) return null;

  if (reduceMotion) {
    return (
      <motion.div
        className={styles.intro}
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.25, delay: 0.1 }}
        aria-hidden="true"
      />
    );
  }

  return (
    <motion.div
      className={styles.intro}
      initial={{ opacity: 1 }}
      animate={{ opacity: [1, 1, 0] }}
      transition={{ duration: 7, times: [0, 0.886, 1], ease: "easeInOut" }}
      aria-hidden="true"
    >
      <div className={styles.vignette} />
      <motion.div
        className={styles.lockup}
        initial={{ opacity: 0, scale: 0.96, filter: "blur(14px)" }}
        animate={{
          opacity: [0, 0, 0.16, 1, 1],
          scale: [0.96, 0.96, 0.98, 1, 1],
          filter: ["blur(14px)", "blur(14px)", "blur(8px)", "blur(0px)", "blur(0px)"],
        }}
        transition={{ duration: 4.2, times: [0, 0.166, 0.25, 0.55, 1], ease: "easeOut" }}
      >
        <div className={styles.logoStage}>
          <Image className={styles.logo} src="/logo.png" alt="" width={168} height={168} priority />
          <motion.div
            className={`${styles.logo} ${styles.glitchRed}`}
            animate={{ opacity: [0, 0, 0.65, 0, 0.4, 0], x: [0, 0, -4, 2, -2, 0] }}
            transition={{ duration: 2.3, times: [0, 0.77, 0.8, 0.86, 0.91, 1] }}
          >
            <Image className={styles.logo} src="/logo.png" alt="" width={168} height={168} />
          </motion.div>
          <motion.div
            className={`${styles.logo} ${styles.glitchCyan}`}
            animate={{ opacity: [0, 0, 0.55, 0, 0.35, 0], x: [0, 0, 4, -2, 2, 0] }}
            transition={{ duration: 2.3, times: [0, 0.77, 0.81, 0.87, 0.92, 1] }}
          >
            <Image className={styles.logo} src="/logo.png" alt="" width={168} height={168} />
          </motion.div>
          <motion.div
            className={styles.sweep}
            initial={{ x: "-160%", opacity: 0 }}
            animate={{ x: "190%", opacity: [0, 0.8, 0] }}
            transition={{ duration: 1.8, delay: 2.15, ease: "easeInOut" }}
          >
            <Image
              className={styles.sweepLogo}
              src="/logo.png"
              alt=""
              width={168}
              height={168}
            />
          </motion.div>
        </div>

        <motion.div
          className={styles.wordmark}
          initial={{ opacity: 0, letterSpacing: "0.72em", x: "0.36em" }}
          animate={{ opacity: 1, letterSpacing: "0.34em", x: "0.17em" }}
          transition={{ duration: 0.9, delay: 2.3, ease: [0.22, 1, 0.36, 1] }}
        >
          PLAYCREW
        </motion.div>
        <motion.div
          className={styles.tagline}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 0.58, y: 0 }}
          transition={{ duration: 0.55, delay: 3.25, ease: "easeOut" }}
        >
          YOUR GAMES. YOUR STORY.
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
