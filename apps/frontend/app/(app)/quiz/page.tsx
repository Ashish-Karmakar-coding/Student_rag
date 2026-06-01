"use client";
/**
 * apps/frontend/app/(app)/quiz/page.tsx
 * Socratic quiz interface — fetch question → answer → evaluate → next.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Zap, Loader2, ChevronRight, CheckCircle2,
  XCircle, RefreshCw, Brain, Lightbulb, ArrowRight,
} from "lucide-react";
import { getNextQuestion, submitAnswer } from "../../../lib/api";
import { getMasteryColor, invalidateMastery } from "../../../lib/useMastery";
import type { QuizNextResponse, QuizAnswerResponse } from "@study-tutor/shared";

type Phase = "idle" | "loading-q" | "question" | "answering" | "evaluating" | "result";

export default function QuizPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [question, setQuestion] = useState<QuizNextResponse | null>(null);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<QuizAnswerResponse | null>(null);
  const [hintVisible, setHintVisible] = useState(false);

  const fetchQuestion = async () => {
    setPhase("loading-q");
    setAnswer("");
    setResult(null);
    setHintVisible(false);
    try {
      const q = await getNextQuestion();
      setQuestion(q);
      setPhase("question");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to get question");
      setPhase("idle");
    }
  };

  const handleSubmit = async () => {
    if (!answer.trim() || !question) return;
    setPhase("evaluating");
    try {
      const res = await submitAnswer(question.questionId, answer.trim());
      setResult(res);
      setPhase("result");
      await invalidateMastery();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Evaluation failed");
      setPhase("question");
    }
  };

  const scoreColor = result ? getMasteryColor(result.score) : "#fff";
  const scorePct = result ? Math.round(result.score * 100) : 0;

  return (
    <div className="min-h-screen p-8 max-w-2xl mx-auto flex flex-col">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600/30 to-cyan-700/20 border border-indigo-500/25 flex items-center justify-center">
          <Zap size={20} className="text-indigo-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Quiz Mode</h1>
          <p className="text-sm text-white/40">Socratic questions targeting your weakest concepts</p>
        </div>
      </motion.div>

      <div className="flex-1">
        <AnimatePresence mode="wait">
          {/* ── Idle ──────────────────────────────────────────────────────── */}
          {phase === "idle" && (
            <motion.div key="idle" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="glass rounded-3xl p-12 text-center"
            >
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/10 border border-indigo-500/25 flex items-center justify-center mx-auto mb-6">
                <Brain size={36} className="text-indigo-400" />
              </div>
              <h2 className="text-2xl font-bold mb-3">Ready to be tested?</h2>
              <p className="text-white/45 text-sm mb-8 max-w-sm mx-auto leading-relaxed">
                The tutor will ask a Socratic question targeting your weakest concept.
                Your answer updates your mastery score.
              </p>
              <button id="quiz-start-btn" onClick={fetchQuestion} className="btn-primary flex items-center gap-2 mx-auto">
                Start Quiz <Zap size={16} />
              </button>
            </motion.div>
          )}

          {/* ── Loading question ───────────────────────────────────────────── */}
          {phase === "loading-q" && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="glass rounded-3xl p-12 text-center"
            >
              <Loader2 size={32} className="text-violet-400 animate-spin mx-auto mb-4" />
              <p className="text-white/50">Generating your next question…</p>
            </motion.div>
          )}

          {/* ── Question ───────────────────────────────────────────────────── */}
          {(phase === "question" || phase === "answering") && question && (
            <motion.div key="question" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* Metadata */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="concept-pill">{question.concept}</span>
                <span className="text-xs px-2 py-1 rounded-full border border-white/10 text-white/40 capitalize">
                  {question.difficulty}
                </span>
                <span className="text-xs text-white/30 ml-auto">
                  Mastery: <span style={{ color: getMasteryColor(question.masteryBefore) }}>
                    {Math.round(question.masteryBefore * 100)}%
                  </span>
                </span>
              </div>

              {/* Question card */}
              <div className="glass rounded-2xl p-6"
                style={{ borderColor: "rgba(79,70,229,0.2)", background: "linear-gradient(135deg, rgba(79,70,229,0.08), rgba(6,182,212,0.04))" }}
              >
                <div className="flex items-start gap-3">
                  <Zap size={20} className="text-indigo-400 mt-0.5 shrink-0" />
                  <p className="text-white/90 leading-relaxed font-medium">{question.question}</p>
                </div>

                {/* Hint */}
                <div className="mt-4">
                  <button onClick={() => setHintVisible(!hintVisible)} className="text-xs text-white/30 hover:text-amber-400 transition-colors flex items-center gap-1">
                    <Lightbulb size={12} />
                    {hintVisible ? "Hide hint" : "Show hint"}
                  </button>
                  <AnimatePresence>
                    {hintVisible && (
                      <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                        className="text-xs text-amber-300/70 mt-2 pl-2 border-l border-amber-500/30"
                      >
                        💡 {question.hint}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Answer */}
              <div>
                <label className="text-xs text-white/40 mb-2 block">Your answer</label>
                <textarea
                  id="quiz-answer-input"
                  rows={4}
                  value={answer}
                  onChange={(e) => { setAnswer(e.target.value); setPhase("answering"); }}
                  placeholder="Type your answer here… Think through the concept step by step."
                  className="input-field resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  id="quiz-submit-btn"
                  onClick={handleSubmit}
                  disabled={!answer.trim()}
                  className="btn-primary flex items-center gap-2 disabled:opacity-40"
                >
                  Submit Answer <ArrowRight size={15} />
                </button>
                <button onClick={fetchQuestion} className="btn-ghost flex items-center gap-2">
                  <RefreshCw size={14} /> New question
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Evaluating ─────────────────────────────────────────────────── */}
          {phase === "evaluating" && (
            <motion.div key="evaluating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="glass rounded-3xl p-12 text-center"
            >
              <Loader2 size={32} className="text-violet-400 animate-spin mx-auto mb-4" />
              <p className="text-white/50">Evaluating your answer…</p>
            </motion.div>
          )}

          {/* ── Result ─────────────────────────────────────────────────────── */}
          {phase === "result" && result && question && (
            <motion.div key="result" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              {/* Score */}
              <div className="glass rounded-2xl p-6" style={{ borderColor: `${scoreColor}30` }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    {result.score >= 0.6
                      ? <CheckCircle2 size={20} className="text-green-400" />
                      : <XCircle size={20} className="text-red-400" />
                    }
                    <span className="font-semibold">
                      {result.score >= 0.6 ? "Good job!" : result.score >= 0.4 ? "Partially correct" : "Keep practicing"}
                    </span>
                  </div>
                  <span className="text-3xl font-black" style={{ color: scoreColor }}>{scorePct}%</span>
                </div>

                {/* Mastery delta */}
                <div className="flex items-center gap-3 mb-4 pb-4 border-b border-white/5">
                  <div className="text-xs text-white/40">Mastery change:</div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs" style={{ color: getMasteryColor(result.masteryBefore) }}>
                      {Math.round(result.masteryBefore * 100)}%
                    </span>
                    <ChevronRight size={12} className="text-white/25" />
                    <span className="text-sm font-bold" style={{ color: getMasteryColor(result.masteryAfter) }}>
                      {Math.round(result.masteryAfter * 100)}%
                    </span>
                    <span className={`text-xs font-medium ${result.delta >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {result.delta >= 0 ? "+" : ""}{(result.delta * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Feedback */}
                <p className="text-sm text-white/75 leading-relaxed mb-3">{result.feedback}</p>

                {/* Explanation */}
                <div className="bg-white/[0.03] rounded-xl p-4 border border-white/5">
                  <p className="text-xs text-white/35 mb-2 flex items-center gap-1"><Brain size={12} /> Full explanation</p>
                  <p className="text-sm text-white/65 leading-relaxed">{result.explanation}</p>
                </div>
              </div>

              <div className="flex gap-3">
                <button id="quiz-next-btn" onClick={fetchQuestion} className="btn-primary flex items-center gap-2">
                  Next Question <Zap size={15} />
                </button>
                <button onClick={() => setPhase("idle")} className="btn-ghost">Finish</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
