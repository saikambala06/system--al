"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Signup failed");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = (() => {
    let score = 0;
    if (password.length >= 8) score++;
    if (password.match(/[A-Z]/)) score++;
    if (password.match(/[0-9]/)) score++;
    if (password.match(/[^A-Za-z0-9]/)) score++;
    return score;
  })();

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-12">
      {/* Background effects */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute -top-40 right-1/2 h-[600px] w-[600px] translate-x-1/2 rounded-full bg-violet-500/20 blur-[120px] animate-float" />
        <div className="absolute -bottom-40 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-brand-500/20 blur-[120px]" />
      </div>

      {/* Floating orbs */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white/5 animate-float"
            style={{
              width: `${Math.random() * 100 + 40}px`,
              height: `${Math.random() * 100 + 40}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${i * 0.8}s`,
              animationDuration: `${Math.random() * 4 + 4}s`,
            }}
          />
        ))}
      </div>

      {/* Card */}
      <div className="animate-fade-in w-full max-w-md">
        {/* Logo */}
        <Link
          href="/"
          className="mb-8 flex items-center justify-center gap-2"
        >
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
          <span className="text-xl font-bold">
            Job<span className="text-brand-400">Fill</span> AI
          </span>
        </Link>

        <div className="glass-strong rounded-3xl p-8 sm:p-10">
          <h1 className="text-2xl font-bold">Create your account</h1>
          <p className="mt-2 text-slate-400">
            Start auto-filling job applications with AI
          </p>

          {/* Progress steps */}
          <div className="mt-6 flex gap-2">
            {[0, 1, 2].map((s) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                  s <= step
                    ? "bg-gradient-to-r from-brand-500 to-violet-500"
                    : "bg-slate-700/50"
                }`}
              />
            ))}
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {/* Name */}
            <div
              className={`transition-all duration-500 ${
                step >= 0
                  ? "translate-y-0 opacity-100"
                  : "translate-y-2 opacity-0"
              }`}
            >
              <label
                htmlFor="name"
                className="mb-1.5 block text-sm font-medium text-slate-300"
              >
                Full Name
              </label>
              <div
                className={`rounded-xl border transition-all duration-300 ${
                  focused === "name"
                    ? "border-brand-500 shadow-lg shadow-brand-500/10"
                    : "border-slate-700/50"
                }`}
              >
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (e.target.value.length >= 2) setStep(1);
                    else setStep(0);
                  }}
                  onFocus={() => setFocused("name")}
                  onBlur={() => setFocused(null)}
                  required
                  placeholder="John Doe"
                  className="w-full rounded-xl bg-white/5 px-4 py-3 text-white placeholder-slate-500 outline-none transition-colors focus:bg-white/[0.07]"
                />
              </div>
            </div>

            {/* Email */}
            <div
              className={`transition-all duration-500 ${
                step >= 1
                  ? "translate-y-0 opacity-100"
                  : "translate-y-2 opacity-0"
              }`}
            >
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-slate-300"
              >
                Email
              </label>
              <div
                className={`rounded-xl border transition-all duration-300 ${
                  focused === "email"
                    ? "border-brand-500 shadow-lg shadow-brand-500/10"
                    : "border-slate-700/50"
                }`}
              >
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (e.target.value.includes("@")) setStep(2);
                    else if (name.length >= 2) setStep(1);
                  }}
                  onFocus={() => setFocused("email")}
                  onBlur={() => setFocused(null)}
                  required
                  placeholder="you@example.com"
                  className="w-full rounded-xl bg-white/5 px-4 py-3 text-white placeholder-slate-500 outline-none transition-colors focus:bg-white/[0.07]"
                />
              </div>
            </div>

            {/* Password */}
            <div
              className={`transition-all duration-500 ${
                step >= 2
                  ? "translate-y-0 opacity-100"
                  : "translate-y-2 opacity-0"
              }`}
            >
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-slate-300"
              >
                Password
              </label>
              <div
                className={`rounded-xl border transition-all duration-300 ${
                  focused === "password"
                    ? "border-brand-500 shadow-lg shadow-brand-500/10"
                    : "border-slate-700/50"
                }`}
              >
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocused("password")}
                  onBlur={() => setFocused(null)}
                  required
                  placeholder="Min. 8 characters"
                  className="w-full rounded-xl bg-white/5 px-4 py-3 text-white placeholder-slate-500 outline-none transition-colors focus:bg-white/[0.07]"
                />
              </div>
              {/* Password strength */}
              {password.length > 0 && (
                <div className="mt-2 flex gap-1.5">
                  {[1, 2, 3, 4].map((level) => (
                    <div
                      key={level}
                      className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                        level <= passwordStrength
                          ? level <= 2
                            ? "bg-yellow-500"
                            : level <= 3
                              ? "bg-brand-500"
                              : "bg-emerald-500"
                          : "bg-slate-700/50"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div
              className={`transition-all duration-500 ${
                step >= 2
                  ? "translate-y-0 opacity-100"
                  : "translate-y-2 opacity-0"
              }`}
            >
              <label
                htmlFor="confirmPassword"
                className="mb-1.5 block text-sm font-medium text-slate-300"
              >
                Confirm Password
              </label>
              <div
                className={`rounded-xl border transition-all duration-300 ${
                  focused === "confirmPassword"
                    ? "border-brand-500 shadow-lg shadow-brand-500/10"
                    : "border-slate-700/50"
                }`}
              >
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onFocus={() => setFocused("confirmPassword")}
                  onBlur={() => setFocused(null)}
                  required
                  placeholder="Repeat your password"
                  className={`w-full rounded-xl px-4 py-3 outline-none transition-colors ${
                    confirmPassword && password !== confirmPassword
                      ? "bg-red-500/10 text-red-400"
                      : "bg-white/5 text-white focus:bg-white/[0.07]"
                  } placeholder-slate-500`}
                />
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="mt-1 text-xs text-red-400">
                  Passwords do not match
                </p>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="animate-slide-up rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-brand-500 to-violet-500 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-500/30 transition-all hover:shadow-xl hover:shadow-brand-500/40 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="h-5 w-5 animate-spin"
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
                  Creating account...
                </span>
              ) : (
                "Create Account"
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-400">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-brand-400 hover:text-brand-300 transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
