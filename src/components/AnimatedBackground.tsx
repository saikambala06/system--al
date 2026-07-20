"use client";

import { motion } from "framer-motion";

export default function AnimatedBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#05040f]">
      <motion.div
        className="absolute -top-40 -left-40 h-[32rem] w-[32rem] rounded-full bg-gradient-to-br from-fuchsia-600/40 to-indigo-600/30 blur-3xl"
        animate={{ x: [0, 60, -20, 0], y: [0, 40, -30, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-1/3 -right-32 h-[28rem] w-[28rem] rounded-full bg-gradient-to-br from-cyan-500/30 to-violet-600/30 blur-3xl"
        animate={{ x: [0, -50, 30, 0], y: [0, -40, 20, 0] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-[-10rem] left-1/4 h-[26rem] w-[26rem] rounded-full bg-gradient-to-br from-emerald-500/20 to-blue-600/25 blur-3xl"
        animate={{ x: [0, 40, -30, 0], y: [0, -20, 30, 0] }}
        transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.06)_1px,transparent_0)] bg-[size:28px_28px]" />
    </div>
  );
}
