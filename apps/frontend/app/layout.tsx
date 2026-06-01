/**
 * apps/frontend/app/layout.tsx
 * Root layout — wraps all pages with providers, fonts, and toaster.
 */

import type { Metadata } from "next";
import "@fontsource/inter/300.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "./globals.css";
import { Toaster } from "sonner";
import { SessionProvider } from "./providers";

export const metadata: Metadata = {
  title: "StudyTutor — AI-Powered Adaptive Learning",
  description:
    "Upload your notes and get a personalized AI tutor that adapts to your weaknesses in real time. Powered by RAG, LangGraph, and your choice of AI model.",
  keywords: ["AI tutor", "adaptive learning", "RAG", "study assistant", "LangGraph"],
  openGraph: {
    title: "StudyTutor — Adaptive AI Tutor",
    description: "Personalized AI tutoring that adapts to your weak spots in real time.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="bg-[#090910] text-white antialiased">
        <SessionProvider>
          {children}
        </SessionProvider>
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#161627",
              border: "1px solid rgba(255,255,255,0.07)",
              color: "#fff",
            },
          }}
        />
      </body>
    </html>
  );
}
