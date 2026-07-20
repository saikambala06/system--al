import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "AutoFillAI — Smart Job Application Autofill",
  description:
    "AI-powered dashboard and browser extension that instantly fills out job application forms with your saved answers.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#05040f] text-slate-100 antialiased">{children}</body>
    </html>
  );
}
