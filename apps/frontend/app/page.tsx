"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
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
    gradient: "from-violet-500/20 to-purple-600/10",
    border: "rgba(124,58,237,0.3)",
  },
  {
    icon: MessageSquare,
    title: "Socratic Tutor",
    description: "Quiz mode asks guiding questions — never gives answers directly. Guided discovery that sticks.",
    gradient: "from-indigo-500/20 to-blue-600/10",
    border: "rgba(79,70,229,0.3)",
  },
  {
    icon: Zap,
    title: "Hybrid RAG",
    description: "BM25 + dense vector search fused via RRF. Cohere reranking optional. Always finds the right chunk.",
    gradient: "from-cyan-500/20 to-indigo-600/10",
    border: "rgba(6,182,212,0.3)",
  },
  {
    icon: GitBranch,
    title: "LangGraph Engine",
    description: "Stateful tutor loop with typed nodes. Explain vs quiz branching, mastery update on every answer.",
    gradient: "from-pink-500/20 to-rose-600/10",
    border: "rgba(236,72,153,0.3)",
  },
  {
    icon: Lock,
    title: "Your Keys, Your Data",
    description: "API keys stored in your OS keychain. All data scoped to your GitHub identity. Zero leakage.",
    gradient: "from-emerald-500/20 to-teal-600/10",
    border: "rgba(16,185,129,0.3)",
  },
  {
    icon: BarChart3,
    title: "Mastery Dashboard",
    description: "Concept-level scores, streaks, and subject breakdowns. See exactly where to focus next.",
    gradient: "from-amber-500/20 to-orange-600/10",
    border: "rgba(245,158,11,0.3)",
  },
];

const steps = [
  { icon: GitBranch, label: "Sign in with GitHub", detail: "OAuth — no password needed" },
  { icon: Upload, label: "Upload your notes", detail: "PDF, DOCX, or Markdown" },
  { icon: Brain, label: "AI ingests & tags", detail: "Chunks, embeds, extracts concepts" },
  { icon: Sparkles, label: "Start studying", detail: "Chat or quiz mode, adapts to you" },
];

const providers = [
  { name: "Ollama", badge: "Local", color: "#7c3aed" },
  { name: "OpenAI", badge: "Cloud", color: "#4f46e5" },
  { name: "Anthropic", badge: "Cloud", color: "#06b6d4" },
];

// ── Animation variants ────────────────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
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
      fetch("/api/sync-user", { method: "POST" })
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
    await signIn("github", { callbackUrl: "/" });
  };

  return (
    <div className="min-h-screen bg-[#090910] overflow-hidden">

      {/* ── Background orbs ─────────────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="orb w-[600px] h-[600px] bg-violet-600/20 -top-48 -left-48 animate-pulse-slow" />
        <div className="orb w-[500px] h-[500px] bg-indigo-600/15 top-1/3 -right-32 animate-pulse-slow" style={{ animationDelay: "2s" }} />
        <div className="orb w-[400px] h-[400px] bg-cyan-600/10 bottom-0 left-1/4 animate-pulse-slow" style={{ animationDelay: "4s" }} />
      </div>

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-2.5"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-glow-sm">
            <Brain size={16} className="text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight">StudyTutor</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
          <a
            href="https://github.com"
            className="text-sm text-white/50 hover:text-white/90 transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
          <button
            id="nav-signin-btn"
            onClick={handleSignIn}
            disabled={isSigningIn || status === "loading"}
            className="btn-primary text-sm py-2.5 px-5 flex items-center gap-2"
          >
            {isSigningIn ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Signing in…
              </>
            ) : (
              <>Sign in with GitHub</>
            )}
          </button>
        </motion.div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative z-10 text-center px-6 pt-20 pb-28 max-w-5xl mx-auto">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300 text-sm font-medium mb-8"
        >
          <Sparkles size={13} />
          Full-stack TypeScript · LangGraph · Hybrid RAG
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.05] mb-6"
        >
          Your AI tutor that
          <br />
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: "linear-gradient(135deg, #a78bfa 0%, #7c3aed 40%, #4f46e5 70%, #06b6d4 100%)" }}
          >
            adapts to you
          </span>
        </motion.h1>

        {/* Sub-headline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5 }}
          className="text-lg text-white/55 max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          Upload your notes. Get a Socratic tutor that tracks your mastery score per concept,
          retrieves the right content, and adapts every question to where you struggle most.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          <button
            id="hero-signin-btn"
            onClick={handleSignIn}
            disabled={isSigningIn || status === "loading"}
            className="btn-primary flex items-center gap-2.5 text-base py-3.5 px-8"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844a9.59 9.59 0 012.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" /></svg>
            Get started free
          </button>
          <a href="#features" className="btn-ghost flex items-center gap-2">
            See how it works <ChevronRight size={16} />
          </a>
        </motion.div>

        {/* Provider badges */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="mt-10 flex items-center justify-center gap-3 flex-wrap"
        >
          <span className="text-sm text-white/30">Works with</span>
          {providers.map((p) => (
            <span
              key={p.name}
              className="px-3 py-1 rounded-full text-xs font-semibold border"
              style={{
                borderColor: `${p.color}40`,
                color: p.color,
                background: `${p.color}12`,
              }}
            >
              {p.name} · {p.badge}
            </span>
          ))}
        </motion.div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section id="features" className="relative z-10 max-w-5xl mx-auto px-6 pb-24">
        <div className="text-center mb-14">
          <motion.h2
            custom={0}
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="text-3xl font-bold mb-3"
          >
            Four steps to mastery
          </motion.h2>
          <p className="text-white/45 text-base">From upload to deep understanding in minutes</p>
        </div>

        <div className="relative flex flex-col sm:flex-row gap-4 sm:gap-2 justify-between items-start sm:items-center">
          {/* Connector line */}
          <div className="hidden sm:block absolute top-8 left-[12%] right-[12%] h-px bg-gradient-to-r from-violet-500/30 via-indigo-500/50 to-cyan-500/30" />

          {steps.map((step, i) => (
            <motion.div
              key={step.label}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="flex flex-col items-center text-center flex-1 relative z-10"
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600/30 to-indigo-700/20 border border-violet-500/25 flex items-center justify-center mb-4 shadow-glow-sm">
                <step.icon size={24} className="text-violet-300" />
              </div>
              <div className="font-semibold text-sm text-white/90 mb-1">{step.label}</div>
              <div className="text-xs text-white/40">{step.detail}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Feature grid ─────────────────────────────────────────────────── */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-28">
        <div className="text-center mb-14">
          <motion.h2
            custom={0}
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="text-3xl font-bold mb-3"
          >
            Built for serious learners
          </motion.h2>
          <p className="text-white/45">Every technical decision made with depth in mind</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="glass glass-hover p-6 group cursor-default"
              style={{ background: `linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))` }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                style={{ background: `linear-gradient(135deg, ${f.border}30, transparent)`, border: `1px solid ${f.border}` }}
              >
                <f.icon size={20} style={{ color: f.border.replace("0.3", "0.9") }} />
              </div>
              <h3 className="font-semibold text-white/90 mb-2">{f.title}</h3>
              <p className="text-sm text-white/45 leading-relaxed">{f.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── CTA strip ────────────────────────────────────────────────────── */}
      <section className="relative z-10 max-w-3xl mx-auto px-6 pb-28 text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass p-12 rounded-3xl relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.12), rgba(79,70,229,0.06))" }}
        >
          <div className="orb w-64 h-64 bg-violet-600/25 -top-16 -right-16" />
          <CheckCircle size={40} className="text-violet-400 mx-auto mb-5" />
          <h2 className="text-3xl font-bold mb-3">Ready to study smarter?</h2>
          <p className="text-white/50 mb-8 text-base leading-relaxed max-w-md mx-auto">
            Sign in with GitHub and upload your first document. Your adaptive tutor will be ready in seconds.
          </p>
          <button
            id="cta-signin-btn"
            onClick={handleSignIn}
            disabled={isSigningIn}
            className="btn-primary inline-flex items-center gap-2.5 text-base py-3.5 px-8"
          >
            Start learning now <ArrowRight size={18} />
          </button>
        </motion.div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-white/5 py-8 px-6 text-center text-white/30 text-sm">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <BookOpen size={11} className="text-white" />
            </div>
            <span>StudyTutor</span>
          </div>
          <span>Hono · Next.js 14 · LangGraph.js · Pinecone · MongoDB</span>
          <span>Built with TypeScript · MIT License</span>
        </div>
      </footer>
    </div>
  );
}
