import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import AnimatedBackground from "@/components/AnimatedBackground";
import DashboardNav from "@/components/DashboardNav";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="relative flex min-h-screen">
      <AnimatedBackground />
      <DashboardNav name={session.name} email={session.email} />
      <main className="min-h-screen flex-1 overflow-y-auto p-6 md:p-10">{children}</main>
    </div>
  );
}
