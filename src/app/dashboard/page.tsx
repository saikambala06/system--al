"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

type Profile = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  location: string | null;
  linkedin: string | null;
  website: string | null;
  resumeText: string | null;
  fields: Record<string, string> | null;
  createdAt: string;
};

type Template = {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  tags: string[] | null;
  createdAt: string;
};

type Application = {
  id: string;
  profileId: string | null;
  jobTitle: string;
  company: string | null;
  jobUrl: string | null;
  status: string;
  answers: Record<string, string> | null;
  createdAt: string;
};

type UserData = {
  id: string;
  name: string;
  email: string;
};

type Tab = "profiles" | "templates" | "applications" | "autofill";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("profiles");

  // Data states
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);

  // Form states
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editProfile, setEditProfile] = useState<Profile | null>(null);
  const [editTemplate, setEditTemplate] = useState<Template | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");

  // Profile form
  const [pName, setPName] = useState("");
  const [pEmail, setPEmail] = useState("");
  const [pPhone, setPPhone] = useState("");
  const [pLocation, setPLocation] = useState("");
  const [pLinkedin, setPLinkedin] = useState("");
  const [pWebsite, setPWebsite] = useState("");
  const [pResumeText, setPResumeText] = useState("");
  const [pFieldsJson, setPFieldsJson] = useState("{}");

  // Template form
  const [tQuestion, setTQuestion] = useState("");
  const [tAnswer, setTAnswer] = useState("");
  const [tCategory, setTCategory] = useState("");
  const [templateSearch, setTemplateSearch] = useState("");

  // Auto-fill states
  const [autoFillUrl, setAutoFillUrl] = useState("");
  const [autoFillQuestions, setAutoFillQuestions] = useState("");
  const [autoFillResults, setAutoFillResults] = useState<
    Record<
      string,
      {
        matched: boolean;
        confidence: number;
        suggestedAnswer?: string;
      }
    > | null
  >(null);
  const [autoFillLoading, setAutoFillLoading] = useState(false);
  const [autoFillProfileId, setAutoFillProfileId] = useState("");

  // Auth check
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (!data.user) {
          router.push("/login");
        } else {
          setUser(data.user);
        }
      })
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!user) return;
    const [profilesRes, templatesRes, appsRes] = await Promise.all([
      fetch("/api/profiles").then((r) => r.json()),
      fetch("/api/templates").then((r) => r.json()),
      fetch("/api/applications").then((r) => r.json()),
    ]);
    setProfiles(profilesRes.profiles || []);
    setTemplates(templatesRes.templates || []);
    setApplications(appsRes.applications || []);
  }, [user]);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  // Profile CRUD
  const resetProfileForm = () => {
    setPName("");
    setPEmail("");
    setPPhone("");
    setPLocation("");
    setPLinkedin("");
    setPWebsite("");
    setPResumeText("");
    setPFieldsJson("{}");
    setEditProfile(null);
  };

  const openEditProfile = (p: Profile) => {
    setEditProfile(p);
    setPName(p.name);
    setPEmail(p.email);
    setPPhone(p.phone || "");
    setPLocation(p.location || "");
    setPLinkedin(p.linkedin || "");
    setPWebsite(p.website || "");
    setPResumeText(p.resumeText || "");
    setPFieldsJson(JSON.stringify(p.fields || {}, null, 2));
    setShowProfileForm(true);
  };

  const openEditTemplate = (t: Template) => {
    setEditTemplate(t);
    setTQuestion(t.question);
    setTAnswer(t.answer);
    setTCategory(t.category || "");
    setShowTemplateForm(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormLoading(true);

    try {
      let fields: Record<string, string> = {};
      try {
        fields = JSON.parse(pFieldsJson);
      } catch {
        setFormError("Invalid JSON in custom fields");
        setFormLoading(false);
        return;
      }

      const body = {
        name: pName,
        email: pEmail,
        phone: pPhone || undefined,
        location: pLocation || undefined,
        linkedin: pLinkedin || undefined,
        website: pWebsite || undefined,
        resumeText: pResumeText || undefined,
        fields,
      };

      const url = editProfile
        ? "/api/profiles"
        : "/api/profiles";
      const method = editProfile ? "PUT" : "POST";
      const payload = editProfile ? { ...body, id: editProfile.id } : body;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Failed to save profile");
      } else {
        setShowProfileForm(false);
        resetProfileForm();
        fetchData();
      }
    } catch {
      setFormError("Something went wrong");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteProfile = async (id: string) => {
    if (!confirm("Delete this profile?")) return;
    await fetch(`/api/profiles?id=${id}`, { method: "DELETE" });
    fetchData();
  };

  // Template CRUD
  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormLoading(true);

    try {
      const url = "/api/templates";
      const method = editTemplate ? "PUT" : "POST";
      const body: Record<string, unknown> = {
        question: tQuestion,
        answer: tAnswer,
        category: tCategory || undefined,
      };
      if (editTemplate) body.id = editTemplate.id;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Failed to save template");
      } else {
        setShowTemplateForm(false);
        setTQuestion("");
        setTAnswer("");
        setTCategory("");
        setEditTemplate(null);
        fetchData();
      }
    } catch {
      setFormError("Something went wrong");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    await fetch(`/api/templates?id=${id}`, { method: "DELETE" });
    fetchData();
  };

  // Auto-fill
  const handleAutoFill = async () => {
    if (!autoFillQuestions.trim()) return;
    setAutoFillLoading(true);
    setAutoFillResults(null);

    try {
      const questions = autoFillQuestions
        .split("\n")
        .map((q) => q.trim())
        .filter(Boolean);

      const res = await fetch("/api/ai/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions }),
      });

      const data = await res.json();
      if (res.ok) {
        setAutoFillResults(data.results);
      }
    } catch {
      setFormError("Auto-fill failed");
    } finally {
      setAutoFillLoading(false);
    }
  };

  // Quick start auto-fill with profile
  const handleQuickStart = async () => {
    if (!autoFillProfileId) return;

    const profile = profiles.find((p) => p.id === autoFillProfileId);
    if (!profile) return;

    // Generate common job questions and fill from profile
    const questions = [
      "What is your full name?",
      "What is your email address?",
      "What is your phone number?",
      "Where are you located?",
      "What is your LinkedIn profile?",
      "Do you have a website or portfolio?",
      "Please paste your resume or describe your experience",
    ];

    await fetch("/api/ai/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questions }),
    })
      .then((r) => r.json())
      .then((data) => {
        // Merge with profile data
        const merged: Record<string, { matched: boolean; confidence: number; suggestedAnswer?: string }> = {};

        for (const q of questions) {
          const aiResult = data.results?.[q];
          let answer: string | undefined;

          if (q.includes("full name")) answer = profile.name;
          else if (q.includes("email")) answer = profile.email;
          else if (q.includes("phone")) answer = profile.phone || undefined;
          else if (q.includes("located") || q.includes("location"))
            answer = profile.location || undefined;
          else if (q.includes("LinkedIn"))
            answer = profile.linkedin || undefined;
          else if (q.includes("website") || q.includes("portfolio"))
            answer = profile.website || undefined;
          else if (q.includes("resume"))
            answer = profile.resumeText || undefined;
          else if (aiResult?.matched) answer = aiResult.suggestedAnswer;

          merged[q] = {
            matched: !!answer,
            confidence: answer ? 1.0 : 0,
            suggestedAnswer: answer,
          };
        }

        setAutoFillResults(merged);
      });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <svg
            className="h-10 w-10 animate-spin text-brand-400"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <p className="text-slate-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const filteredTemplates = templateSearch.trim()
    ? templates.filter((t) => {
        const q = templateSearch.toLowerCase().trim();
        return (
          t.question.toLowerCase().includes(q) ||
          t.answer.toLowerCase().includes(q) ||
          (t.category || "").toLowerCase().includes(q)
        );
      })
    : templates;

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden lg:flex lg:w-72 lg:flex-col lg:border-r lg:border-slate-800/50">
        <div className="flex h-full flex-col p-6">
          {/* Logo */}
          <div className="mb-8 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-violet-500">
              <svg
                className="h-5 w-5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <span className="text-lg font-bold">
              Job<span className="text-brand-400">Fill</span>
            </span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1">
            {[
              { id: "profiles" as Tab, label: "Profiles", icon: "👤" },
              { id: "templates" as Tab, label: "Q&A Templates", icon: "📝" },
              {
                id: "applications" as Tab,
                label: "Applications",
                icon: "💼",
              },
              { id: "autofill" as Tab, label: "Auto-Fill", icon: "⚡" },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                  activeTab === item.id
                    ? "bg-brand-500/10 text-brand-400 shadow-sm"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>

          {/* User section */}
          <div className="mt-auto border-t border-slate-800/50 pt-4">
            <div className="flex items-center gap-3 rounded-xl p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-violet-500 text-sm font-bold">
                {user?.name?.charAt(0) || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium">{user?.name}</p>
                <p className="truncate text-xs text-slate-400">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="mt-2 w-full rounded-xl px-4 py-2.5 text-sm text-slate-400 transition-all hover:bg-red-500/10 hover:text-red-400"
            >
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile nav */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-800/50 bg-slate-950/90 backdrop-blur-xl lg:hidden">
        <div className="flex">
          {[
            { id: "profiles" as Tab, label: "Profiles", icon: "👤" },
            { id: "templates" as Tab, label: "Q&A", icon: "📝" },
            { id: "applications" as Tab, label: "Jobs", icon: "💼" },
            { id: "autofill" as Tab, label: "Fill", icon: "⚡" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-1 flex-col items-center gap-1 py-3 text-xs transition-all ${
                activeTab === item.id
                  ? "text-brand-400"
                  : "text-slate-500"
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-auto pb-20 lg:pb-0">
        <div className="mx-auto max-w-5xl p-6 lg:p-10">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold lg:text-3xl">
                {activeTab === "profiles" && "Your Profiles"}
                {activeTab === "templates" && "Q&A Templates"}
                {activeTab === "applications" && "Job Applications"}
                {activeTab === "autofill" && "AI Auto-Fill"}
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                {activeTab === "profiles" &&
                  "Manage your personal profiles for auto-filling"}
                {activeTab === "templates" &&
                  "Saved questions and answers the AI learns from"}
                {activeTab === "applications" &&
                  "Track your job applications"}
                {activeTab === "autofill" &&
                  "Test and use the AI auto-fill engine"}
              </p>
            </div>
          </div>

          {/* Profiles Tab */}
          {activeTab === "profiles" && (
            <div className="space-y-6">
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    resetProfileForm();
                    setShowProfileForm(true);
                  }}
                  className="rounded-xl bg-gradient-to-r from-brand-500 to-violet-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/20 transition-all hover:brightness-110"
                >
                  + New Profile
                </button>
              </div>

              {showProfileForm && (
                <div className="animate-slide-up glass-strong rounded-2xl p-6">
                  <h3 className="mb-4 text-lg font-semibold">
                    {editProfile ? "Edit Profile" : "Create Profile"}
                  </h3>
                  <form onSubmit={handleSaveProfile} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm text-slate-400">
                          Full Name *
                        </label>
                        <input
                          value={pName}
                          onChange={(e) => setPName(e.target.value)}
                          required
                          className="w-full rounded-xl border border-slate-700/50 bg-white/5 px-4 py-2.5 text-white outline-none focus:border-brand-500"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm text-slate-400">
                          Email *
                        </label>
                        <input
                          type="email"
                          value={pEmail}
                          onChange={(e) => setPEmail(e.target.value)}
                          required
                          className="w-full rounded-xl border border-slate-700/50 bg-white/5 px-4 py-2.5 text-white outline-none focus:border-brand-500"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm text-slate-400">
                          Phone
                        </label>
                        <input
                          value={pPhone}
                          onChange={(e) => setPPhone(e.target.value)}
                          className="w-full rounded-xl border border-slate-700/50 bg-white/5 px-4 py-2.5 text-white outline-none focus:border-brand-500"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm text-slate-400">
                          Location
                        </label>
                        <input
                          value={pLocation}
                          onChange={(e) => setPLocation(e.target.value)}
                          className="w-full rounded-xl border border-slate-700/50 bg-white/5 px-4 py-2.5 text-white outline-none focus:border-brand-500"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm text-slate-400">
                          LinkedIn
                        </label>
                        <input
                          value={pLinkedin}
                          onChange={(e) => setPLinkedin(e.target.value)}
                          placeholder="https://linkedin.com/in/..."
                          className="w-full rounded-xl border border-slate-700/50 bg-white/5 px-4 py-2.5 text-white outline-none focus:border-brand-500"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm text-slate-400">
                          Website
                        </label>
                        <input
                          value={pWebsite}
                          onChange={(e) => setPWebsite(e.target.value)}
                          placeholder="https://..."
                          className="w-full rounded-xl border border-slate-700/50 bg-white/5 px-4 py-2.5 text-white outline-none focus:border-brand-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm text-slate-400">
                        Resume / Experience Text
                      </label>
                      <textarea
                        value={pResumeText}
                        onChange={(e) => setPResumeText(e.target.value)}
                        rows={4}
                        placeholder="Paste your resume text or key experience points..."
                        className="w-full rounded-xl border border-slate-700/50 bg-white/5 px-4 py-2.5 text-white outline-none focus:border-brand-500"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm text-slate-400">
                        Custom Fields (JSON)
                      </label>
                      <textarea
                        value={pFieldsJson}
                        onChange={(e) => setPFieldsJson(e.target.value)}
                        rows={4}
                        className="w-full rounded-xl border border-slate-700/50 bg-white/5 px-4 py-2.5 font-mono text-sm text-white outline-none focus:border-brand-500"
                      />
                    </div>

                    {formError && (
                      <p className="text-sm text-red-400">{formError}</p>
                    )}

                    <div className="flex gap-3">
                      <button
                        type="submit"
                        disabled={formLoading}
                        className="rounded-xl bg-gradient-to-r from-brand-500 to-violet-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/20 transition-all hover:brightness-110 disabled:opacity-50"
                      >
                        {formLoading ? "Saving..." : "Save Profile"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowProfileForm(false);
                          resetProfileForm();
                        }}
                        className="rounded-xl border border-slate-700/50 px-6 py-2.5 text-sm font-medium text-slate-400 transition-all hover:text-white"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {profiles.length === 0 && !showProfileForm && (
                <div className="glass rounded-2xl p-12 text-center">
                  <div className="text-4xl">👤</div>
                  <h3 className="mt-4 text-lg font-semibold">
                    No profiles yet
                  </h3>
                  <p className="mt-2 text-sm text-slate-400">
                    Create your first profile to start auto-filling job
                    applications.
                  </p>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                {profiles.map((p) => (
                  <div
                    key={p.id}
                    className="glass-strong rounded-2xl p-6 transition-all hover:border-brand-500/30"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold">{p.name}</h3>
                        <p className="text-sm text-slate-400">{p.email}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEditProfile(p)}
                          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                          title="Edit"
                        >
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.5}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteProfile(p.id)}
                          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
                          title="Delete"
                        >
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.5}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs">
                      {p.phone && (
                        <span className="rounded-full bg-white/5 px-3 py-1 text-slate-400">
                          📱 {p.phone}
                        </span>
                      )}
                      {p.location && (
                        <span className="rounded-full bg-white/5 px-3 py-1 text-slate-400">
                          📍 {p.location}
                        </span>
                      )}
                      {p.linkedin && (
                        <span className="rounded-full bg-white/5 px-3 py-1 text-slate-400">
                          🔗 LinkedIn
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Templates Tab */}
          {activeTab === "templates" && (
            <div className="space-y-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative sm:max-w-sm sm:flex-1">
                  <svg
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                    />
                  </svg>
                  <input
                    type="text"
                    value={templateSearch}
                    onChange={(e) => setTemplateSearch(e.target.value)}
                    placeholder="Search Q&A templates..."
                    className="w-full rounded-xl border border-slate-700/50 bg-white/5 py-2.5 pl-10 pr-9 text-sm text-white outline-none transition-colors focus:border-brand-500"
                  />
                  {templateSearch && (
                    <button
                      onClick={() => setTemplateSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition-colors hover:text-white"
                      title="Clear search"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                <button
                  onClick={() => {
                    setEditTemplate(null);
                    setTQuestion("");
                    setTAnswer("");
                    setTCategory("");
                    setShowTemplateForm(true);
                  }}
                  className="shrink-0 rounded-xl bg-gradient-to-r from-brand-500 to-violet-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/20 transition-all hover:brightness-110"
                >
                  + New Q&A Template
                </button>
              </div>

              {showTemplateForm && (
                <div className="animate-slide-up glass-strong rounded-2xl p-6">
                  <h3 className="mb-4 text-lg font-semibold">
                    {editTemplate ? "Edit Question & Answer" : "Add Question & Answer"}
                  </h3>
                  <form onSubmit={handleSaveTemplate} className="space-y-4">
                    <div>
                      <label className="mb-1 block text-sm text-slate-400">
                        Question *
                      </label>
                      <input
                        value={tQuestion}
                        onChange={(e) => setTQuestion(e.target.value)}
                        required
                        placeholder="e.g., Why do you want to work here?"
                        className="w-full rounded-xl border border-slate-700/50 bg-white/5 px-4 py-2.5 text-white outline-none focus:border-brand-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-slate-400">
                        Your Answer *
                      </label>
                      <textarea
                        value={tAnswer}
                        onChange={(e) => setTAnswer(e.target.value)}
                        required
                        rows={3}
                        placeholder="Your standard answer..."
                        className="w-full rounded-xl border border-slate-700/50 bg-white/5 px-4 py-2.5 text-white outline-none focus:border-brand-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-slate-400">
                        Category
                      </label>
                      <input
                        value={tCategory}
                        onChange={(e) => setTCategory(e.target.value)}
                        placeholder="e.g., Behavioral, Technical, Personal"
                        className="w-full rounded-xl border border-slate-700/50 bg-white/5 px-4 py-2.5 text-white outline-none focus:border-brand-500"
                      />
                    </div>
                    {formError && (
                      <p className="text-sm text-red-400">{formError}</p>
                    )}
                    <div className="flex gap-3">
                      <button
                        type="submit"
                        disabled={formLoading}
                        className="rounded-xl bg-gradient-to-r from-brand-500 to-violet-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/20 transition-all hover:brightness-110 disabled:opacity-50"
                      >
                        {formLoading ? "Saving..." : editTemplate ? "Update Template" : "Save Template"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowTemplateForm(false);
                          setTQuestion("");
                          setTAnswer("");
                          setTCategory("");
                          setEditTemplate(null);
                        }}
                        className="rounded-xl border border-slate-700/50 px-6 py-2.5 text-sm font-medium text-slate-400 transition-all hover:text-white"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {templates.length === 0 && !showTemplateForm && (
                <div className="glass rounded-2xl p-12 text-center">
                  <div className="text-4xl">📝</div>
                  <h3 className="mt-4 text-lg font-semibold">
                    No Q&A templates yet
                  </h3>
                  <p className="mt-2 text-sm text-slate-400">
                    Add questions and answers so the AI can learn and auto-fill
                    similar questions.
                  </p>
                </div>
              )}

              {templates.length > 0 && filteredTemplates.length === 0 && (
                <div className="glass rounded-2xl p-12 text-center">
                  <div className="text-4xl">🔍</div>
                  <h3 className="mt-4 text-lg font-semibold">
                    No matching Q&A templates
                  </h3>
                  <p className="mt-2 text-sm text-slate-400">
                    Nothing matches &ldquo;{templateSearch}&rdquo;. Try a different search term.
                  </p>
                </div>
              )}

              <div className="space-y-3">
                {filteredTemplates.map((t) => (
                  <div
                    key={t.id}
                    className="glass-strong rounded-2xl p-5 transition-all hover:border-brand-500/30"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {t.category && (
                            <span className="rounded-full bg-brand-500/10 px-2.5 py-0.5 text-xs font-medium text-brand-400">
                              {t.category}
                            </span>
                          )}
                        </div>
                        <p className="mt-2 font-medium text-white">
                          {t.question}
                        </p>
                        <p className="mt-1.5 text-sm text-slate-400 line-clamp-2">
                          {t.answer}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          onClick={() => openEditTemplate(t)}
                          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                          title="Edit"
                        >
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.5}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(t.id)}
                          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
                          title="Delete"
                        >
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.5}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Applications Tab */}
          {activeTab === "applications" && (
            <div className="space-y-6">
              {applications.length === 0 && (
                <div className="glass rounded-2xl p-12 text-center">
                  <div className="text-4xl">💼</div>
                  <h3 className="mt-4 text-lg font-semibold">
                    No applications tracked
                  </h3>
                  <p className="mt-2 text-sm text-slate-400">
                    Job applications will appear here when you use the
                    auto-fill extension.
                  </p>
                </div>
              )}

              <div className="space-y-3">
                {applications.map((app) => (
                  <div
                    key={app.id}
                    className="glass-strong rounded-2xl p-5 transition-all hover:border-brand-500/30"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold">{app.jobTitle}</h3>
                        <p className="text-sm text-slate-400">
                          {app.company || "Unknown company"}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          app.status === "completed"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : app.status === "in_progress"
                              ? "bg-brand-500/10 text-brand-400"
                              : "bg-slate-500/10 text-slate-400"
                        }`}
                      >
                        {app.status}
                      </span>
                    </div>
                    {app.jobUrl && (
                      <a
                        href={app.jobUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-block text-xs text-brand-400 hover:underline"
                      >
                        View Job Posting →
                      </a>
                    )}
                    {app.answers && Object.keys(app.answers).length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-medium text-slate-400">
                          Answers: {Object.keys(app.answers).length} fields
                          filled
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Auto-Fill Tab */}
          {activeTab === "autofill" && (
            <div className="space-y-6">
              {/* Quick Start Card */}
              <div className="animate-slide-up glass-strong rounded-2xl p-8 text-center">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-brand-500/20 to-violet-500/20">
                  <svg
                    className="h-10 w-10 text-brand-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-bold">Quick Start Auto-Fill</h3>
                <p className="mt-2 text-slate-400">
                  Select a profile and click start to see how the AI fills job
                  applications.
                </p>

                <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
                  <select
                    value={autoFillProfileId}
                    onChange={(e) => setAutoFillProfileId(e.target.value)}
                    className="rounded-xl border border-slate-700/50 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-500"
                  >
                    <option value="" className="bg-slate-900">
                      Select a profile...
                    </option>
                    {profiles.map((p) => (
                      <option
                        key={p.id}
                        value={p.id}
                        className="bg-slate-900"
                      >
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleQuickStart}
                    disabled={!autoFillProfileId}
                    className="relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-brand-500 to-violet-500 px-8 py-3 text-base font-semibold text-white shadow-lg shadow-brand-500/30 transition-all hover:shadow-xl hover:shadow-brand-500/40 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span>⚡ Start Auto-Fill</span>
                  </button>
                </div>
              </div>

              {/* Manual Test */}
              <div className="glass-strong rounded-2xl p-6">
                <h3 className="mb-4 text-lg font-semibold">
                  Manual AI Match Test
                </h3>
                <p className="mb-4 text-sm text-slate-400">
                  Paste job application questions (one per line) to see which
                  ones the AI can auto-fill from your saved templates.
                </p>
                <textarea
                  value={autoFillQuestions}
                  onChange={(e) => setAutoFillQuestions(e.target.value)}
                  rows={5}
                  placeholder={`What is your full name?\nWhat is your email address?\nWhy do you want to work here?\nTell us about your experience with React`}
                  className="w-full rounded-xl border border-slate-700/50 bg-white/5 px-4 py-3 text-white outline-none focus:border-brand-500"
                />
                <button
                  onClick={handleAutoFill}
                  disabled={autoFillLoading || !autoFillQuestions.trim()}
                  className="mt-4 rounded-xl bg-gradient-to-r from-brand-500 to-violet-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/20 transition-all hover:brightness-110 disabled:opacity-50"
                >
                  {autoFillLoading ? (
                    <span className="flex items-center gap-2">
                      <svg
                        className="h-4 w-4 animate-spin"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Matching...
                    </span>
                  ) : (
                    "🔍 Match Questions"
                  )}
                </button>
              </div>

              {/* Results */}
              {autoFillResults && (
                <div className="animate-slide-up space-y-3">
                  <h3 className="text-lg font-semibold">Results</h3>
                  {Object.entries(autoFillResults).map(
                    ([question, result]) => (
                      <div
                        key={question}
                        className={`glass-strong rounded-2xl p-5 border-l-4 ${
                          result.matched
                            ? "border-emerald-500"
                            : "border-slate-600"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-white">
                              {question}
                            </p>
                            {result.matched && result.suggestedAnswer ? (
                              <p className="mt-2 rounded-xl bg-emerald-500/5 border border-emerald-500/10 p-3 text-sm text-emerald-300">
                                {result.suggestedAnswer}
                              </p>
                            ) : (
                              <p className="mt-2 text-sm text-slate-500 italic">
                                No matching answer found. Add more Q&A templates
                                to improve coverage.
                              </p>
                            )}
                          </div>
                          <div className="shrink-0">
                            {result.matched ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
                                ✅{" "}
                                {Math.round(result.confidence * 100)}% match
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/10 px-3 py-1 text-xs font-medium text-slate-400">
                                ❌ No match
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
