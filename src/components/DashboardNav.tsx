"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  UserRound,
  MessageSquareText,
  Puzzle,
  LogOut,
  Sparkles,
} from "lucide-react";

const links = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/profile", label: "Profile", icon: UserRound },
  { href: "/dashboard/questions", label: "Saved Q&A", icon: MessageSquareText },
  { href: "/dashboard/extension", label: "Extension", icon: Puzzle },
];

export default function DashboardNav({ name, email }: { name: string; email: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-white/10 bg-white/[0.02] p-5">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-indigo-500 shadow-lg shadow-fuchsia-500/30">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <span className="text-lg font-semibold tracking-tight text-white">AutoFillAI</span>
      </Link>

      <nav className="flex flex-1 flex-col gap-1.5">
        {links.map((link) => {
          const active = pathname === link.href;
          return (
            <Link key={link.href} href={link.href} className="relative">
              {active && (
                <motion.div
                  layoutId="dashboard-nav-active"
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-fuchsia-500/20 to-indigo-500/20"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <div
                className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  active ? "text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <link.icon className="h-4 w-4" />
                {link.label}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-white/10 pt-4">
        <p className="truncate text-sm font-medium text-white">{name}</p>
        <p className="truncate text-xs text-slate-500">{email}</p>
        <button
          onClick={handleLogout}
          className="mt-3 flex w-full items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300 transition hover:border-red-400/30 hover:bg-red-500/10 hover:text-red-300"
        >
          <LogOut className="h-4 w-4" />
          Log out
        </button>
      </div>
    </aside>
  );
}
