import Link from "next/link";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { profiles, qaPairs, apiTokens, fillHistory } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import {
  UserRound,
  MessageSquareText,
  Puzzle,
  ArrowUpRight,
  CheckCircle2,
  Circle,
  History,
} from "lucide-react";

const PROFILE_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "address",
  "city",
  "country",
  "linkedin",
  "currentTitle",
  "yearsExperience",
  "workAuthorization",
  "summary",
] as const;

export const dynamic = "force-dynamic";

export default async function DashboardOverviewPage() {
  const session = await getSession();
  const userId = session!.userId;

  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  const questions = await db.select().from(qaPairs).where(eq(qaPairs.userId, userId));
  const tokens = await db.select().from(apiTokens).where(eq(apiTokens.userId, userId));
  const history = await db
    .select()
    .from(fillHistory)
    .where(eq(fillHistory.userId, userId))
    .orderBy(desc(fillHistory.createdAt))
    .limit(5);

  const filledFieldsCount = profile
    ? PROFILE_FIELDS.filter((f) => Boolean((profile as Record<string, unknown>)[f])).length
    : 0;
  const completeness = Math.round((filledFieldsCount / PROFILE_FIELDS.length) * 100);

  const stats = [
    {
      label: "Profile completeness",
      value: `${completeness}%`,
      icon: UserRound,
      href: "/dashboard/profile",
      accent: "from-fuchsia-500/20 to-indigo-500/20 text-fuchsia-300",
    },
    {
      label: "Saved Q&A answers",
      value: String(questions.length),
      icon: MessageSquareText,
      href: "/dashboard/questions",
      accent: "from-cyan-500/20 to-violet-500/20 text-cyan-300",
    },
    {
      label: "Active extension tokens",
      value: String(tokens.filter((t) => t.isActive).length),
      icon: Puzzle,
      href: "/dashboard/extension",
      accent: "from-emerald-500/20 to-teal-500/20 text-emerald-300",
    },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold text-white">Welcome back, {session!.name.split(" ")[0]} 👋</h1>
      <p className="mt-1 text-sm text-slate-400">
        Here&apos;s the state of your autofill profile across every job application.
      </p>

      <div className="mt-8 grid gap-5 sm:grid-cols-3">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="group rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-fuchsia-400/30 hover:bg-white/[0.06]"
          >
            <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${stat.accent}`}>
              <stat.icon className="h-5 w-5" />
            </div>
            <p className="text-2xl font-bold text-white">{stat.value}</p>
            <p className="mt-1 flex items-center gap-1 text-sm text-slate-400">
              {stat.label}
              <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" />
            </p>
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-lg font-semibold text-white">Profile checklist</h2>
          <p className="mt-1 text-sm text-slate-400">Complete these so the extension can fill everything accurately.</p>
          <ul className="mt-4 space-y-2.5">
            {PROFILE_FIELDS.map((field) => {
              const done = profile ? Boolean((profile as Record<string, unknown>)[field]) : false;
              return (
                <li key={field} className="flex items-center gap-2 text-sm">
                  {done ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Circle className="h-4 w-4 text-slate-600" />
                  )}
                  <span className={done ? "text-slate-200" : "text-slate-500"}>
                    {fieldLabel(field)}
                  </span>
                </li>
              );
            })}
          </ul>
          <Link
            href="/dashboard/profile"
            className="mt-5 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-fuchsia-500 to-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:scale-[1.02]"
          >
            Complete profile <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="mb-1 flex items-center gap-2">
            <History className="h-4 w-4 text-slate-400" />
            <h2 className="text-lg font-semibold text-white">Recent autofill activity</h2>
          </div>
          <p className="mb-4 text-sm text-slate-400">Latest job pages the extension filled in for you.</p>
          {history.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">
              No activity yet — install the extension and click Start on a job application.
            </p>
          ) : (
            <ul className="space-y-3">
              {history.map((h) => (
                <li key={h.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-200">{h.siteTitle || h.siteUrl}</p>
                    <p className="truncate text-xs text-slate-500">{h.siteUrl}</p>
                  </div>
                  <span className="ml-3 shrink-0 rounded-full bg-fuchsia-500/10 px-2.5 py-1 text-xs font-medium text-fuchsia-300">
                    {h.fieldsFilled} fields
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function fieldLabel(field: string) {
  const map: Record<string, string> = {
    firstName: "First name",
    lastName: "Last name",
    email: "Email address",
    phone: "Phone number",
    address: "Address",
    city: "City",
    country: "Country",
    linkedin: "LinkedIn URL",
    currentTitle: "Current job title",
    yearsExperience: "Years of experience",
    workAuthorization: "Work authorization",
    summary: "Professional summary",
  };
  return map[field] || field;
}
