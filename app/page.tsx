"use client";

import { motion } from "framer-motion";
import TetrisExperience from "../components/TetrisExperience";

export default function Page() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <motion.div
          className="pointer-events-none absolute inset-0"
          animate={{ opacity: [0.8, 0.4, 0.8] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          style={{
            background:
              "radial-gradient(circle at 15% 20%, rgba(99,102,241,0.35), transparent 55%), radial-gradient(circle at 80% 10%, rgba(59,130,246,0.25), transparent 45%), radial-gradient(circle at 50% 85%, rgba(190,18,60,0.2), transparent 45%)"
          }}
        />
      </div>

      <main className="mx-auto flex min-h-screen max-w-6xl flex-col items-center gap-10 px-4 pb-16 pt-24 md:pt-32">
        <motion.header
          className="flex flex-col items-center text-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <span className="mb-3 rounded-full border border-white/10 bg-white/10 px-4 py-1 text-xs uppercase tracking-[0.4em] text-white/70 backdrop-blur">
            Hyper-Casual. Hyper-Competitive.
          </span>
          <h1 className="font-display text-4xl font-semibold leading-tight text-white md:text-6xl">
            Lumina<span className="text-transparent tetris-gradient bg-clip-text"> Tetris</span>
          </h1>
          <p className="mt-4 max-w-2xl text-base text-white/80 md:text-lg">
            Neon-drenched blocks, competitive leaderboards, adaptive soundtrack, and pro-level analytics.
            Dive into the market-breaking reinvention of the most iconic puzzle ever made.
          </p>
        </motion.header>

        <TetrisExperience />
      </main>
    </div>
  );
}
