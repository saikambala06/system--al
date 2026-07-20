"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Plus, Trash2, Pencil, X, Check, MessageSquareText, Sparkles } from "lucide-react";

type QaPair = {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  source: string | null;
  updatedAt: string;
};

export default function QuestionsPage() {
  const [items, setItems] = useState<QaPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [category, setCategory] = useState("general");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQuestion, setEditQuestion] = useState("");
  const [editAnswer, setEditAnswer] = useState("");
  const [search, setSearch] = useState("");

  function load() {
    setLoading(true);
    fetch("/api/questions")
      .then((r) => r.json())
      .then((data) => setItems(data.questions || []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) return;
    setSubmitting(true);
    const res = await fetch("/api/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, answer, category }),
    });
    setSubmitting(false);
    if (res.ok) {
      setQuestion("");
      setAnswer("");
      setCategory("general");
      load();
    }
  }

  async function handleDelete(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await fetch(`/api/questions/${id}`, { method: "DELETE" });
  }

  function startEdit(item: QaPair) {
    setEditingId(item.id);
    setEditQuestion(item.question);
    setEditAnswer(item.answer);
  }

  async function saveEdit(id: string) {
    const res = await fetch(`/api/questions/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: editQuestion, answer: editAnswer, category: "general" }),
    });
    if (res.ok) {
      setEditingId(null);
      load();
    }
  }

  const filtered = items.filter(
    (i) =>
      i.question.toLowerCase().includes(search.toLowerCase()) ||
      i.answer.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold text-white">Saved questions & answers</h1>
      <p className="mt-1 text-sm text-slate-400">
        Add recurring application questions once. The extension matches similar wording automatically across every
        job site, and the AI learns new ones as you go.
      </p>

      <form onSubmit={handleAdd} className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-white">
          <Plus className="h-4 w-4 text-fuchsia-400" /> Add a new answer
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-slate-300">Question (as it appears on forms)</label>
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Why do you want to work here?"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-400/60 focus:bg-white/[0.08] focus:ring-2 focus:ring-fuchsia-400/20"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-slate-300">Your answer</label>
            <textarea
              rows={3}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="I'm excited about this role because..."
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-400/60 focus:bg-white/[0.08] focus:ring-2 focus:ring-fuchsia-400/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-300">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#0b0a18] px-3 py-2.5 text-sm text-white outline-none focus:border-fuchsia-400/60"
            >
              <option value="general">General</option>
              <option value="behavioral">Behavioral</option>
              <option value="eligibility">Eligibility</option>
              <option value="technical">Technical</option>
              <option value="compensation">Compensation</option>
            </select>
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="submit"
          disabled={submitting}
          className="mt-4 flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-fuchsia-600/30 transition disabled:opacity-70"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Save answer
        </motion.button>
      </form>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold text-white">
          <MessageSquareText className="h-4 w-4 text-slate-400" />
          Your library ({items.length})
        </h2>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search..."
          className="w-48 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white outline-none focus:border-fuchsia-400/60"
        />
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">
          No saved answers yet. Add your first one above.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          <AnimatePresence>
            {filtered.map((item) => (
              <motion.li
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
              >
                {editingId === item.id ? (
                  <div className="space-y-3">
                    <input
                      value={editQuestion}
                      onChange={(e) => setEditQuestion(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/60"
                    />
                    <textarea
                      rows={3}
                      value={editAnswer}
                      onChange={(e) => setEditAnswer(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/60"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEdit(item.id)}
                        className="flex items-center gap-1 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/30"
                      >
                        <Check className="h-3.5 w-3.5" /> Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="flex items-center gap-1 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10"
                      >
                        <X className="h-3.5 w-3.5" /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-white">{item.question}</p>
                        {item.source === "ai" && (
                          <span className="flex items-center gap-1 rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold text-violet-300">
                            <Sparkles className="h-3 w-3" /> AI learned
                          </span>
                        )}
                        {item.category && (
                          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                            {item.category}
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-400">{item.answer}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => startEdit(item)}
                        className="rounded-lg border border-white/10 p-2 text-slate-400 transition hover:border-fuchsia-400/30 hover:text-fuchsia-300"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="rounded-lg border border-white/10 p-2 text-slate-400 transition hover:border-red-400/30 hover:text-red-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
