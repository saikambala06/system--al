"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import AnimatedBackground from "@/components/AnimatedBackground";
import {
  Sparkles,
  Puzzle,
  ShieldCheck,
  Zap,
  BrainCircuit,
  MousePointerClick,
  LayoutDashboard,
  Code2,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.08, ease: "easeOut" as const },
  }),
};

const steps = [
  {
    icon: LayoutDashboard,
    title: "Build your profile once",
    desc: "Sign up, fill your personal, education, and experience details, and save any recurring application questions with your best answers.",
  },
  {
    icon: Puzzle,
    title: "Install the extension",
    desc: "Connect the AutoFillAI companion extension to your account with a single secure token from your dashboard.",
  },
  {
    icon: MousePointerClick,
    title: "Click Start on any job form",
    desc: "Open a job application on any site — Workday, Greenhouke, Lever, custom React/HTML forms — and hit Start.",
  },
  {
    icon: BrainCircuit,
    title: "AI matches every field",
    desc: "AutoFillAI reads every label on the page, matches it to your saved answers, and lets AI reason out anything new — then remembers it.",
  },
];

const features = [
  {
    icon: Sparkles,
    title: "AI Question Matching",
    desc: "Semantic matching finds the right saved answer even when two companies phrase the same question differently.",
  },
  {
    icon: Zap,
    title: "Works Everywhere",
    desc: "Accurately fills plain HTML forms as well as React, Vue, and Angular-driven application builders.",
  },
  {
    icon: ShieldCheck,
    title: "Secure by Design",
    desc: "Your data lives in your own account, protected by hashed passwords and scoped API tokens for the extension.",
  },
  {
    icon: BrainCircuit,
    title: "Learns As You Go",
    desc: "Every new question the AI answers gets saved automatically, so the next application fills even faster.",
  },
];

export default function HomePage() {
  return (
    <main className="relative overflow-hidden">
      <AnimatedBackground />

      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-indigo-500 shadow-lg shadow-fuchsia-500/30">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-semibold tracking-tight text-white">AutoFillAI</span>
        </div>
        <nav className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-full px-4 py-2 text-sm font-medium text-slate-200 transition hover:text-white"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-white/10 transition hover:scale-[1.03] hover:bg-slate-100"
          >
            Get started
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto flex max-w-6xl flex-col items-center px-6 pb-24 pt-16 text-center">
        <motion.div
          initial="hidden"
          animate="show"
          variants={fadeUp}
          custom={0}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-slate-300 backdrop-blur"
        >
          <Sparkles className="h-3.5 w-3.5 text-fuchsia-400" />
          AI-powered job application autofill
        </motion.div>

        <motion.h1
          initial="hidden"
          animate="show"
          variants={fadeUp}
          custom={1}
          className="mt-6 max-w-3xl text-[clamp(2.2rem,6vw,4rem)] font-bold leading-[1.05] tracking-tight text-white"
        >
          Fill every job application
          <span className="bg-gradient-to-r from-fuchsia-400 via-violet-400 to-cyan-300 bg-clip-text text-transparent">
            {" "}
            in one click.
          </span>
        </motion.h1>

        <motion.p
          initial="hidden"
          animate="show"
          variants={fadeUp}
          custom={2}
          className="mt-6 max-w-2xl text-balance text-lg text-slate-300"
        >
          Save your details once. Our browser extension and AI matching engine
          recognize repeated questions across job boards and instantly fill
          them in accurately — on plain HTML forms or complex React apps.
        </motion.p>

        <motion.div
          initial="hidden"
          animate="show"
          variants={fadeUp}
          custom={3}
          className="mt-10 flex flex-col items-center gap-4 sm:flex-row"
        >
          <Link
            href="/signup"
            className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-indigo-500 px-7 py-3.5 text-base font-semibold text-white shadow-xl shadow-fuchsia-600/30 transition hover:scale-[1.04]"
          >
            Create your free account
            <Zap className="h-4 w-4 transition group-hover:rotate-12" />
          </Link>
          <Link
            href="/dashboard/extension"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-7 py-3.5 text-base font-semibold text-slate-100 backdrop-blur transition hover:bg-white/10"
          >
            <Puzzle className="h-4 w-4" />
            Get the extension
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
          className="relative mt-20 w-full max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-2 shadow-2xl shadow-black/40 backdrop-blur"
        >
          <div className="flex items-center gap-2 rounded-t-2xl bg-white/5 px-4 py-3">
            <span className="h-3 w-3 rounded-full bg-red-400/70" />
            <span className="h-3 w-3 rounded-full bg-yellow-400/70" />
            <span className="h-3 w-3 rounded-full bg-emerald-400/70" />
            <span className="ml-3 text-xs text-slate-400">careers.company.com/apply</span>
          </div>
          <div className="grid gap-3 p-6 text-left sm:grid-cols-2">
            {["Full name", "Email address", "Phone number", "Years of experience", "LinkedIn URL", "Why do you want this role?"].map(
              (label, i) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 + i * 0.12, duration: 0.5 }}
                  className="rounded-xl border border-white/10 bg-[#0b0a18] p-3"
                >
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    transition={{ delay: 1.1 + i * 0.12, duration: 0.4 }}
                    className="mt-2 h-2 rounded-full bg-gradient-to-r from-fuchsia-500/70 to-cyan-400/70"
                  />
                </motion.div>
              ),
            )}
          </div>
        </motion.div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center text-3xl font-bold text-white"
        >
          How AutoFillAI works
        </motion.h2>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur transition hover:border-fuchsia-400/30 hover:bg-white/[0.06]"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500/20 to-indigo-500/20 text-fuchsia-300">
                <step.icon className="h-5 w-5" />
              </div>
              <p className="mb-1 text-xs font-semibold text-fuchsia-300">Step {i + 1}</p>
              <h3 className="mb-2 text-lg font-semibold text-white">{step.title}</h3>
              <p className="text-sm text-slate-400">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-6 md:grid-cols-2">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.5 }}
              className="flex gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 text-cyan-300">
                <f.icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="mb-1 text-lg font-semibold text-white">{f.title}</h3>
                <p className="text-sm text-slate-400">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-6 pb-28 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="rounded-3xl border border-white/10 bg-gradient-to-br from-fuchsia-600/20 via-indigo-600/10 to-cyan-500/10 p-12"
        >
          <h2 className="text-3xl font-bold text-white">Stop retyping your resume.</h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-300">
            Join AutoFillAI today, connect the extension, and apply to 10x more jobs in the same amount of time.
          </p>
          <Link
            href="/signup"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-base font-semibold text-slate-950 shadow-xl transition hover:scale-[1.04]"
          >
            Create your free account
          </Link>
        </motion.div>
      </section>

      <footer className="border-t border-white/10 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm text-slate-500 sm:flex-row">
          <p>© {new Date().getFullYear()} AutoFillAI. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/dashboard/extension" className="hover:text-slate-300">
              Extension
            </Link>
            <a href="https://github.com" className="flex items-center gap-1 hover:text-slate-300">
              <Code2 className="h-4 w-4" /> Source
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
