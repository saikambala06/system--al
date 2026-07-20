"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Loader2,
  Copy,
  Check,
  Plus,
  Trash2,
  Puzzle,
  Download,
  PlayCircle,
  Sparkles,
} from "lucide-react";

type Token = { id: string; token: string; name: string; isActive: boolean; createdAt: string };
type MatchResult = { id: string; value: string; confidence: number; source: string; matchedQuestion?: string };

const DEMO_FIELDS = [
  "First Name",
  "Last Name",
  "Email Address",
  "Phone Number",
  "LinkedIn Profile URL",
  "Years of professional experience",
  "Are you legally authorized to work in this country?",
  "Why do you want to work at our company?",
];

export default function ExtensionPage() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [demoResults, setDemoResults] = useState<MatchResult[] | null>(null);
  const [demoLoading, setDemoLoading] = useState(false);

  function load() {
    setLoading(true);
    fetch("/api/tokens")
      .then((r) => r.json())
      .then((data) => setTokens(data.tokens || []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function createToken() {
    setCreating(true);
    await fetch("/api/tokens", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Browser Extension" }) });
    setCreating(false);
    load();
  }

  async function deleteToken(id: string) {
    setTokens((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/tokens/${id}`, { method: "DELETE" });
  }

  function copy(id: string, token: string) {
    navigator.clipboard.writeText(token);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  async function runDemo() {
    setDemoLoading(true);
    setDemoResults(null);
    const res = await fetch("/api/autofill/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "demo://dashboard-preview",
        title: "Live matching demo",
        fields: DEMO_FIELDS.map((label, i) => ({ id: String(i), label })),
      }),
    });
    const data = await res.json();
    setDemoResults(data.matches || []);
    setDemoLoading(false);
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold text-white">Connect the browser extension</h1>
      <p className="mt-1 text-sm text-slate-400">
        Install AutoFillAI in your browser, paste an access token below, then click{" "}
        <strong className="text-slate-200">Start</strong> on any job application page.
      </p>

      {/* Steps */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          { icon: Download, title: "1. Load the extension", desc: "Unzip the /extension folder and load it as an unpacked extension in Chrome or Edge." },
          { icon: Puzzle, title: "2. Paste your token", desc: "Open the extension popup, paste an access token from below, and click Connect." },
          { icon: PlayCircle, title: "3. Click Start", desc: "On any job application page, open the popup and click Start to autofill instantly." },
        ].map((s) => (
          <div key={s.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <s.icon className="mb-3 h-5 w-5 text-fuchsia-300" />
            <p className="text-sm font-semibold text-white">{s.title}</p>
            <p className="mt-1 text-xs text-slate-400">{s.desc}</p>
          </div>
        ))}
      </div>

      {/* Tokens */}
      <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Access tokens</h2>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={createToken}
            disabled={creating}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-fuchsia-500 to-indigo-500 px-3 py-1.5 text-xs font-semibold text-white shadow-lg shadow-fuchsia-600/20 disabled:opacity-70"
          >
            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            New token
          </motion.button>
        </div>

        {loading ? (
          <div className="mt-6 flex justify-center text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : tokens.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No tokens yet. Create one to connect the extension.</p>
        ) : (
          <ul className="mt-4 space-y-2.5">
            {tokens.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#0b0a18] px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-200">{t.name}</p>
                  <code className="text-xs text-slate-500">{t.token}</code>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copy(t.id, t.token)}
                    className="flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-slate-300 hover:border-fuchsia-400/30 hover:text-fuchsia-300"
                  >
                    {copiedId === t.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedId === t.id ? "Copied" : "Copy"}
                  </button>
                  <button
                    onClick={() => deleteToken(t.id)}
                    className="rounded-lg border border-white/10 p-1.5 text-slate-400 hover:border-red-400/30 hover:text-red-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Demo */}
      <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-white">
            <Sparkles className="h-4 w-4 text-fuchsia-300" /> Try the matching engine
          </h2>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={runDemo}
            disabled={demoLoading}
            className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/15 disabled:opacity-70"
          >
            {demoLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
            Run demo
          </motion.button>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          This simulates a job form with common fields and shows exactly what the extension would fill using your
          saved profile and Q&A data.
        </p>
        <ul className="mt-4 space-y-2">
          {DEMO_FIELDS.map((label, i) => {
            const result = demoResults?.find((r) => r.id === String(i));
            return (
              <li key={label} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#0b0a18] px-4 py-3">
                <span className="text-sm text-slate-300">{label}</span>
                {result ? (
                  <span
                    className={`max-w-[60%] truncate rounded-full px-3 py-1 text-xs font-medium ${
                      result.value
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-slate-500/15 text-slate-400"
                    }`}
                    title={result.value}
                  >
                    {result.value || "No match found — add this to your Q&A"}
                  </span>
                ) : (
                  <span className="text-xs text-slate-600">—</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
