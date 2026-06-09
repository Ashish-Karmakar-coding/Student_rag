"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import axios from "axios";
import {
  Brain, Zap, BookOpen, BarChart3, MessageSquare,
  ChevronRight, Upload, Sparkles, GitBranch, Lock,
  CheckCircle, ArrowRight
} from "lucide-react";

// ── Feature cards data ────────────────────────────────────────────────────────
const features = [
  {
    icon: Brain,
    title: "Adapts to You",
    description: "Tracks mastery scores per concept. Retrieval is boosted toward your weak spots automatically.",
  },
  {
    icon: MessageSquare,
    title: "Socratic Tutor",
    description: "Quiz mode asks guiding questions — never gives answers directly. Guided discovery that sticks.",
  },
  {
    icon: Zap,
    title: "Hybrid RAG",
    description: "BM25 + dense vector search fused via RRF. Cohere reranking optional. Always finds the right chunk.",
  },
  {
    icon: GitBranch,
    title: "LangGraph Engine",
    description: "Stateful tutor loop with typed nodes. Explain vs quiz branching, mastery update on every answer.",
  },
  {
    icon: Lock,
    title: "Your Keys, Your Data",
    description: "API keys stored in your OS keychain. All data scoped to your GitHub identity. Zero leakage.",
  },
  {
    icon: BarChart3,
    title: "Mastery Dashboard",
    description: "Concept-level scores, streaks, and subject breakdowns. See exactly where to focus next.",
  },
];

const steps = [
  { icon: GitBranch, label: "Sign in with GitHub", detail: "OAuth — no password needed" },
  { icon: Upload, label: "Upload your notes", detail: "PDF, DOCX, or Markdown" },
  { icon: Brain, label: "AI ingests & tags", detail: "Chunks, embeds, extracts concepts" },
  { icon: Sparkles, label: "Start studying", detail: "Chat or quiz mode, adapts to you" },
];

const providers = [
  { name: "Ollama", badge: "Local", color: "#7C7AE0" },       // Secondary slate-purple
  { name: "OpenAI", badge: "Cloud", color: "#0F9B7C" },       // Primary teal
  { name: "Anthropic", badge: "Cloud", color: "#bccac3" },    // Muted grey-green
];

// ── Animation variants ────────────────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: [0.16, 1, 0.3, 1] },
  }),
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [synced, setSynced] = useState(false);

  // Redirect authenticated users
  useEffect(() => {
    if (status === "authenticated" && session && !synced) {
      // Sync with backend
      axios.post("/api/sync-user")
        .then(() => setSynced(true))
        .then(() => {
          if (session.user && "hasFiles" in session.user) {
            router.push("/chat");
          } else {
            router.push("/upload");
          }
        })
        .catch(console.error);
    }
  }, [status, session, synced, router]);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    // After GitHub auth completes, NextAuth will redirect here.
    // We send to /upload (new users) — authenticated users in /upload or /chat
    // will be properly handled by the app's routing.
    await signIn("github", { callbackUrl: "/upload" });
  };

  return (
    <div className="min-h-screen bg-surface-base text-text-primary overflow-hidden font-body-default">

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav className="relative z-10 border-b border-border-subtle bg-surface-raised/40 backdrop-blur px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-2.5"
        >
          <div className="w-7.5 h-7.5 rounded bg-primary flex items-center justify-center p-1.5 shrink-0">
            <Brain size={16} className="text-surface-base" />
          </div>
          <span className="font-bold text-sm tracking-tight text-text-primary">StudyTutor</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-4"
        >
          <a
            href="https://github.com"
            className="text-xs text-text-muted hover:text-text-primary transition-colors font-label-mono"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
          <button
            id="nav-signin-btn"
            onClick={handleSignIn}
            disabled={isSigningIn || status === "loading"}
            className="btn-primary text-xs py-2 px-4 flex items-center gap-2"
          >
            {isSigningIn ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-surface-base/30 border-t-surface-base rounded-full animate-spin" />
                Signing in…
              </>
            ) : (
              <>Sign in with GitHub</>
            )}
          </button>
        </motion.div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative z-10 text-center px-6 pt-24 pb-24 max-w-5xl mx-auto">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.08 }}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-surface-raised border border-border-default text-primary text-xs font-semibold mb-8 font-label-mono"
        >
          <Sparkles size={12} />
          Full-stack TypeScript · LangGraph · Hybrid RAG
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.1] mb-6 font-display text-text-primary"
        >
          Your AI tutor that
          <br />
          <span className="text-primary">
            adapts to you
          </span>
        </motion.h1>

        {/* Sub-headline */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          className="text-sm sm:text-base text-text-secondary max-w-2xl mx-auto mb-10 leading-relaxed font-body-default"
        >
          Upload your notes. Get a Socratic tutor that tracks your mastery score per concept,
          retrieves the right content, and adapts every question to where you struggle most.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="flex flex-col sm:flex-row gap-3.5 justify-center items-center"
        >
          <button
            id="hero-signin-btn"
            onClick={handleSignIn}
            disabled={isSigningIn || status === "loading"}
            className="btn-primary flex items-center gap-2 text-sm py-3 px-6"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844a9.59 9.59 0 012.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" /></svg>
            Get started free
          </button>
          <a href="#features" className="btn-secondary flex items-center gap-1.5 text-sm py-3 px-6">
            See how it works <ChevronRight size={14} />
          </a>
        </motion.div>

        {/* Provider badges */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45 }}
          className="mt-12 flex items-center justify-center gap-3 flex-wrap"
        >
          <span className="text-xs text-text-muted font-label-mono">INTEGRATIONS:</span>
          {providers.map((p) => (
            <span
              key={p.name}
              className="px-2.5 py-1 rounded text-[11px] font-label-mono font-medium border"
              style={{
                borderColor: `${p.color}35`,
                color: p.color,
                background: `${p.color}08`,
              }}
            >
              {p.name} · {p.badge}
            </span>
          ))}
        </motion.div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section id="features" className="relative z-10 max-w-5xl mx-auto px-6 pb-24 border-t border-border-subtle pt-20">
        <div className="text-center mb-16">
          <motion.h2
            custom={0}
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="text-2xl font-bold mb-3 tracking-tight text-text-primary"
          >
            Four Steps to Mastery
          </motion.h2>
          <p className="text-text-muted text-xs font-label-mono">FROM NOTE UPLOAD TO ACTIVE RECALL IN SECONDS</p>
        </div>

        <div className="relative flex flex-col md:flex-row gap-6 md:gap-4 justify-between items-start md:items-center">
          {/* Connector line */}
          <div className="hidden md:block absolute top-7 left-[12%] right-[12%] h-0.5 bg-border-default" />

          {steps.map((step, i) => (
            <motion.div
              key={step.label}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="flex flex-col items-center text-center flex-1 relative z-10 w-full"
            >
              <div className="w-14 h-14 rounded bg-surface-raised border border-border-default flex items-center justify-center mb-4">
                <step.icon size={20} className="text-primary" />
              </div>
              <div className="font-semibold text-xs text-text-primary mb-1 tracking-tight">{step.label}</div>
              <div className="text-[11px] text-text-muted font-label-mono">{step.detail}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Feature grid ─────────────────────────────────────────────────── */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-24 border-t border-border-subtle pt-20">
        <div className="text-center mb-16">
          <motion.h2
            custom={0}
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="text-2xl font-bold mb-3 tracking-tight text-text-primary"
          >
            Built for Serious Learners
          </motion.h2>
          <p className="text-text-muted text-xs font-label-mono">TECHNICAL ARCHITECTURE COMMITTED TO CLARITY</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="glass p-5 flex flex-col items-start text-left"
            >
              <div className="w-10 h-10 rounded bg-surface-sunken border border-border-default flex items-center justify-center mb-4 shrink-0">
                <f.icon size={18} className="text-primary" />
              </div>
              <h3 className="font-semibold text-xs tracking-tight text-text-primary mb-2">{f.title}</h3>
              <p className="text-[12px] text-text-muted leading-relaxed font-body-default">{f.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── CTA strip ────────────────────────────────────────────────────── */}
      <section className="relative z-10 max-w-3xl mx-auto px-6 pb-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="glass p-12 rounded-lg border border-border-default bg-surface-raised flex flex-col items-center"
        >
          <CheckCircle size={32} className="text-primary mb-5" />
          <h2 className="text-2xl font-bold mb-3 tracking-tight text-text-primary">Ready to study smarter?</h2>
          <p className="text-text-secondary text-sm mb-8 leading-relaxed max-w-md mx-auto">
            Sign in with GitHub and upload your first document. Your adaptive tutor will be ready in seconds.
          </p>
          <button
            id="cta-signin-btn"
            onClick={handleSignIn}
            disabled={isSigningIn}
            className="btn-primary inline-flex items-center gap-2 text-sm py-3 px-6"
          >
            Start learning now <ArrowRight size={15} />
          </button>
        </motion.div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-border-subtle bg-surface-raised/40 py-8 px-6 text-center text-text-muted text-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 font-label-mono">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-primary flex items-center justify-center p-1">
              <BookOpen size={11} className="text-surface-base" />
            </div>
            <span className="font-bold text-text-primary">StudyTutor</span>
          </div>
          <span>Hono · Next.js 14 · LangGraph.js · Pinecone · MongoDB</span>
          <span>MIT License</span>
        </div>
      </footer>
    </div>
  );
}
