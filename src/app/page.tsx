"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<{
    id: string;
    name: string;
    email: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.user) setUser(data.user);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full bg-brand-500/20 blur-[120px]" />
        <div className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-violet-500/20 blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-fuchsia-500/10 blur-[100px]" />
      </div>

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 -z-10 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Navigation */}
      <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-500 shadow-lg shadow-brand-500/30">
            <svg
              className="h-6 w-6 text-white"
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
          <span className="text-xl font-bold tracking-tight">
            Job<span className="text-brand-400">Fill</span> AI
          </span>
        </div>

        <div className="flex items-center gap-4">
          {!loading && (
            <>
              {user ? (
                <button
                  onClick={() => router.push("/dashboard")}
                  className="rounded-xl bg-gradient-to-r from-brand-500 to-violet-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/30 transition-all hover:shadow-xl hover:shadow-brand-500/40 hover:brightness-110"
                >
                  Dashboard
                </button>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="rounded-xl px-5 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:text-white"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/signup"
                    className="rounded-xl bg-gradient-to-r from-brand-500 to-violet-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/30 transition-all hover:shadow-xl hover:shadow-brand-500/40 hover:brightness-110"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 pb-20 pt-16 sm:pt-24 lg:pt-32">
        <div className="mx-auto max-w-3xl text-center">
          {/* Badge */}
          <div className="animate-fade-in mb-8 inline-flex items-center gap-2 rounded-full border border-brand-500/20 bg-brand-500/10 px-4 py-1.5 text-sm text-brand-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-400" />
            </span>
            AI-Powered Auto-Fill Engine
          </div>

          {/* Headline */}
          <h1 className="animate-slide-up text-5xl font-extrabold leading-[1.1] tracking-tight sm:text-6xl lg:text-7xl">
            Fill Job Applications
            <br />
            <span className="animate-gradient bg-gradient-to-r from-brand-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              In One Click
            </span>
          </h1>

          <p className="animate-slide-up-delay-1 mx-auto mt-6 max-w-xl text-lg leading-relaxed text-slate-400">
            Stop typing the same answers over and over. Our AI learns your
            responses and auto-fills any job application form across any
            website.
          </p>

          {/* CTA */}
          <div className="animate-slide-up-delay-2 mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            {!loading && !user && (
              <Link
                href="/signup"
                className="group relative inline-flex items-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-brand-500 to-violet-500 px-8 py-4 text-lg font-semibold text-white shadow-2xl shadow-brand-500/30 transition-all hover:shadow-brand-500/50 hover:brightness-110"
              >
                <span className="relative z-10">Start Filling Faster</span>
                <svg
                  className="relative z-10 h-5 w-5 transition-transform group-hover:translate-x-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
                <div className="animate-glow absolute inset-0 rounded-2xl" />
              </Link>
            )}
            {user && (
              <button
                onClick={() => router.push("/dashboard")}
                className="group relative inline-flex items-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-brand-500 to-violet-500 px-8 py-4 text-lg font-semibold text-white shadow-2xl shadow-brand-500/30 transition-all hover:shadow-brand-500/50 hover:brightness-110"
              >
                <span className="relative z-10">Go to Dashboard</span>
                <svg
                  className="relative z-10 h-5 w-5 transition-transform group-hover:translate-x-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </button>
            )}
            <a
              href="#features"
              className="rounded-2xl border border-slate-700/50 px-8 py-4 text-lg font-medium text-slate-300 transition-all hover:border-slate-600 hover:text-white"
            >
              How It Works
            </a>
          </div>

          {/* Stats */}
          <div className="animate-slide-up-delay-3 mt-16 grid grid-cols-3 gap-8 rounded-2xl glass p-8">
            {[
              { value: "10x", label: "Faster Applications" },
              { value: "99%", label: "Accuracy Rate" },
              { value: "Any", label: "Job Portal Supported" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-2xl font-bold text-white sm:text-3xl">
                  {stat.value}
                </div>
                <div className="mt-1 text-sm text-slate-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section
        id="features"
        className="relative z-10 mx-auto max-w-7xl px-6 pb-24"
      >
        <div className="text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">
            How It{" "}
            <span className="animate-gradient bg-gradient-to-r from-brand-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              Works
            </span>
          </h2>
          <p className="mt-3 text-slate-400">
            Three simple steps to never type the same thing twice
          </p>
        </div>

        <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              step: "1",
              title: "Create Your Profile",
              desc: "Save your personal details, work history, education, and skills once.",
              icon: (
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              ),
            },
            {
              step: "2",
              title: "Answer Questions Once",
              desc: "As you fill applications, our AI learns your answers to common questions.",
              icon: (
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
                  />
                </svg>
              ),
            },
            {
              step: "3",
              title: "Auto-Fill Any Form",
              desc: "Click the extension on any job portal and watch as all fields fill automatically.",
              icon: (
                <svg
                  className="h-6 w-6"
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
              ),
            },
          ].map((feature, i) => (
            <div
              key={feature.step}
              className={`animate-slide-up-delay-${i + 1} group rounded-2xl glass-strong p-8 transition-all hover:border-brand-500/30 hover:bg-white/[0.10]`}
            >
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500/20 to-violet-500/20 text-brand-400">
                {feature.icon}
              </div>
              <div className="text-sm font-semibold text-brand-400">
                Step {feature.step}
              </div>
              <h3 className="mt-2 text-xl font-semibold">{feature.title}</h3>
              <p className="mt-2 text-slate-400">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800/50 py-8 text-center text-sm text-slate-500">
        <p>&copy; 2026 JobFill AI. All rights reserved.</p>
      </footer>
    </main>
  );
}
