"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Save, CheckCircle2 } from "lucide-react";

type Profile = Record<string, string>;

const SECTIONS: { title: string; fields: { key: string; label: string; placeholder?: string; type?: string }[] }[] = [
  {
    title: "Personal details",
    fields: [
      { key: "firstName", label: "First name" },
      { key: "lastName", label: "Last name" },
      { key: "email", label: "Email address", type: "email" },
      { key: "phone", label: "Phone number" },
      { key: "address", label: "Street address" },
      { key: "city", label: "City" },
      { key: "state", label: "State / Province" },
      { key: "zip", label: "ZIP / Postal code" },
      { key: "country", label: "Country" },
    ],
  },
  {
    title: "Links",
    fields: [
      { key: "linkedin", label: "LinkedIn URL" },
      { key: "github", label: "GitHub URL" },
      { key: "portfolio", label: "Portfolio URL" },
      { key: "website", label: "Personal website" },
    ],
  },
  {
    title: "Work details",
    fields: [
      { key: "currentTitle", label: "Current job title" },
      { key: "currentCompany", label: "Current company" },
      { key: "yearsExperience", label: "Years of experience" },
      { key: "expectedSalary", label: "Expected salary" },
      { key: "noticePeriod", label: "Notice period / start date" },
      { key: "workAuthorization", label: "Work authorization" },
      { key: "needsSponsorship", label: "Requires visa sponsorship?" },
      { key: "willingToRelocate", label: "Willing to relocate?" },
    ],
  },
  {
    title: "Demographic (optional, EEO forms)",
    fields: [
      { key: "gender", label: "Gender" },
      { key: "veteranStatus", label: "Veteran status" },
      { key: "disabilityStatus", label: "Disability status" },
      { key: "race", label: "Race / ethnicity" },
    ],
  },
];

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile>({});
  const [skills, setSkills] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        const p = data.profile || {};
        setProfile(p);
        setSkills(Array.isArray(p.skills) ? p.skills.join(", ") : "");
      })
      .finally(() => setLoading(false));
  }, []);

  function updateField(key: string, value: string) {
    setProfile((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    const payload = {
      ...profile,
      skills: skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Your profile</h1>
          <p className="mt-1 text-sm text-slate-400">
            This data powers accurate autofill across every job application form.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="mt-8 space-y-8">
        {SECTIONS.map((section) => (
          <div key={section.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="mb-4 text-base font-semibold text-white">{section.title}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {section.fields.map((field) => (
                <div key={field.key}>
                  <label className="mb-1.5 block text-xs font-medium text-slate-300">{field.label}</label>
                  <input
                    type={field.type || "text"}
                    value={profile[field.key] || ""}
                    onChange={(e) => updateField(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-400/60 focus:bg-white/[0.08] focus:ring-2 focus:ring-fuchsia-400/20"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="mb-4 text-base font-semibold text-white">Summary & skills</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-300">Professional summary</label>
              <textarea
                rows={3}
                value={profile.summary || ""}
                onChange={(e) => updateField("summary", e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-400/60 focus:bg-white/[0.08] focus:ring-2 focus:ring-fuchsia-400/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-300">Default cover letter</label>
              <textarea
                rows={4}
                value={profile.coverLetter || ""}
                onChange={(e) => updateField("coverLetter", e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-400/60 focus:bg-white/[0.08] focus:ring-2 focus:ring-fuchsia-400/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-300">Skills (comma separated)</label>
              <input
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                placeholder="React, TypeScript, Node.js, SQL"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-fuchsia-400/60 focus:bg-white/[0.08] focus:ring-2 focus:ring-fuchsia-400/20"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-indigo-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-fuchsia-600/30 transition disabled:opacity-70"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save profile
          </motion.button>
          <AnimatePresence>
            {saved && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-1.5 text-sm text-emerald-400"
              >
                <CheckCircle2 className="h-4 w-4" /> Saved
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </form>
    </div>
  );
}
