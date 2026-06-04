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
import { getMasteryColor, invalidateMastery, useMastery } from "../../../lib/useMastery";
import { useFiles } from "../../../lib/useFiles";
import type { QuizNextResponse, QuizAnswerResponse } from "@study-tutor/shared";

type Phase = "idle" | "loading-q" | "question" | "answering" | "evaluating" | "result";

export default function QuizPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [question, setQuestion] = useState<QuizNextResponse | null>(null);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<QuizAnswerResponse | null>(null);
  const [hintVisible, setHintVisible] = useState(false);

  const [quizMode, setQuizMode] = useState<"global" | "subject" | "file">("global");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedFile, setSelectedFile] = useState("");

  const { mastery } = useMastery();
  const { files } = useFiles();
  const subjects = Array.from(new Set(mastery.map(m => m.subject).filter(Boolean)));

  const fetchQuestion = async () => {
    setPhase("loading-q");
    setAnswer("");
    setResult(null);
    setHintVisible(false);
    try {
      const params: any = {};
      if (quizMode === "subject" && selectedSubject) params.subject = selectedSubject;
      if (quizMode === "file" && selectedFile) params.fileName = selectedFile;
      
      const q = await getNextQuestion(params);
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
    <div className="min-h-screen p-8 max-w-2xl mx-auto flex flex-col bg-surface-base text-text-primary font-body-default">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 mb-8 shrink-0">
        <div className="w-10 h-10 rounded bg-surface-raised border border-border-default flex items-center justify-center">
          <Zap size={20} className="text-primary" />
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-tight text-text-primary uppercase">Quiz Mode</h1>
          <p className="text-xs text-text-muted font-label-mono">Socratic questions targeting your weakest concepts</p>
        </div>
      </motion.div>

      <div className="flex-1">
        <AnimatePresence mode="wait">
          {/* ── Idle ──────────────────────────────────────────────────────── */}
          {phase === "idle" && (
            <motion.div key="idle" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="bg-surface-raised border border-border-default rounded-lg p-10 text-center"
            >
              <div className="w-16 h-16 rounded bg-surface-sunken border border-border-default flex items-center justify-center mx-auto mb-6">
                <Brain size={28} className="text-primary" />
              </div>
              <h2 className="text-base font-bold mb-2 tracking-tight text-text-primary">Ready to be tested?</h2>
              
              <div className="max-w-xs mx-auto mb-8 text-left">
                <label className="text-[10px] font-label-caps text-text-muted mb-2 block">Select Quiz Target</label>
                <select 
                  className="input-field w-full mb-3"
                  value={quizMode}
                  onChange={(e) => setQuizMode(e.target.value as any)}
                >
                  <option value="global">Weakest Concept (Global)</option>
                  <option value="subject">By Subject</option>
                  <option value="file">By PDF File</option>
                </select>

                {quizMode === "subject" && (
                  <select 
                    className="input-field w-full"
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                  >
                    <option value="" disabled>Select a subject</option>
                    {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}

                {quizMode === "file" && (
                  <select 
                    className="input-field w-full"
                    value={selectedFile}
                    onChange={(e) => setSelectedFile(e.target.value)}
                  >
                    <option value="" disabled>Select a file</option>
                    {files.map(f => <option key={f.fileName} value={f.fileName}>{f.fileName}</option>)}
                  </select>
                )}
              </div>

              <button 
                id="quiz-start-btn" 
                onClick={fetchQuestion} 
                disabled={(quizMode === "subject" && !selectedSubject) || (quizMode === "file" && !selectedFile)}
                className="btn-primary flex items-center gap-2 mx-auto disabled:opacity-50"
              >
                Start Quiz <Zap size={14} />
              </button>
            </motion.div>
          )}

          {/* ── Loading question ───────────────────────────────────────────── */}
          {phase === "loading-q" && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="bg-surface-raised border border-border-default rounded-lg p-12 text-center"
            >
              <Loader2 size={24} className="text-primary animate-spin mx-auto mb-4" />
              <p className="text-xs font-label-mono text-text-muted">Generating your next question…</p>
            </motion.div>
          )}

          {/* ── Question ───────────────────────────────────────────────────── */}
          {(phase === "question" || phase === "answering") && question && (
            <motion.div key="question" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="space-y-5"
            >
              {/* Metadata */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="concept-pill">{question.concept}</span>
                <span className="text-[10px] font-label-mono px-2 py-0.5 rounded border border-border-subtle bg-surface-sunken text-text-secondary capitalize">
                  {question.difficulty}
                </span>
                <span className="text-xs font-label-mono text-text-muted ml-auto">
                  Mastery: <span style={{ color: getMasteryColor(question.masteryBefore) }} className="font-bold">
                    {Math.round(question.masteryBefore * 100)}%
                  </span>
                </span>
              </div>

              {/* Question card */}
              <div className="bg-surface-raised border border-border-default rounded-lg p-5"
              >
                <div className="flex items-start gap-3">
                  <Zap size={16} className="text-primary mt-0.5 shrink-0" />
                  <p className="text-text-primary text-sm leading-relaxed font-medium">{question.question}</p>
                </div>

                {/* Hint */}
                <div className="mt-4">
                  <button onClick={() => setHintVisible(!hintVisible)} className="text-xs font-label-mono text-text-muted hover:text-secondary transition-colors flex items-center gap-1">
                    <Lightbulb size={12} className="text-secondary" />
                    {hintVisible ? "Hide hint" : "Show hint"}
                  </button>
                  <AnimatePresence>
                    {hintVisible && (
                      <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                        className="text-xs text-secondary bg-surface-sunken p-3 border-l-2 border-secondary rounded-r mt-2 font-body-default"
                      >
                        💡 {question.hint}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Answer */}
              <div>
                <label className="text-[10px] font-label-caps text-text-muted mb-2 block">Your answer</label>
                <textarea
                  id="quiz-answer-input"
                  rows={4}
                  value={answer}
                  onChange={(e) => { setAnswer(e.target.value); setPhase("answering"); }}
                  placeholder="Type your answer here… Think through the concept step by step."
                  className="input-field resize-none min-h-[100px] leading-relaxed"
                />
              </div>

              <div className="flex gap-3">
                <button
                  id="quiz-submit-btn"
                  onClick={handleSubmit}
                  disabled={!answer.trim()}
                  className="btn-primary flex items-center gap-2 disabled:opacity-40"
                >
                  Submit Answer <ArrowRight size={14} />
                </button>
                <button onClick={fetchQuestion} className="btn-secondary flex items-center gap-1.5">
                  <RefreshCw size={12} /> New question
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Evaluating ─────────────────────────────────────────────────── */}
          {phase === "evaluating" && (
            <motion.div key="evaluating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="bg-surface-raised border border-border-default rounded-lg p-12 text-center"
            >
              <Loader2 size={24} className="text-primary animate-spin mx-auto mb-4" />
              <p className="text-xs font-label-mono text-text-muted">Evaluating your answer…</p>
            </motion.div>
          )}

          {/* ── Result ─────────────────────────────────────────────────────── */}
          {phase === "result" && result && question && (
            <motion.div key="result" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              {/* Score */}
              <div className="bg-surface-raised border border-border-default rounded-lg p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    {result.score >= 0.6
                      ? <CheckCircle2 size={18} className="text-primary" />
                      : <XCircle size={18} className="text-error" />
                    }
                    <span className="font-semibold text-sm">
                      {result.score >= 0.6 ? "Good job!" : result.score >= 0.4 ? "Partially correct" : "Keep practicing"}
                    </span>
                  </div>
                  <span className="text-2xl font-black" style={{ color: scoreColor }}>{scorePct}%</span>
                </div>

                {/* Mastery delta */}
                <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border-subtle">
                  <div className="text-[10px] font-label-caps text-text-muted">Mastery change:</div>
                  <div className="flex items-center gap-1.5 font-label-mono text-xs">
                    <span style={{ color: getMasteryColor(result.masteryBefore) }} className="font-semibold">
                      {Math.round(result.masteryBefore * 100)}%
                    </span>
                    <ChevronRight size={12} className="text-text-muted" />
                    <span style={{ color: getMasteryColor(result.masteryAfter) }} className="font-bold">
                      {Math.round(result.masteryAfter * 100)}%
                    </span>
                    <span className={`font-semibold ${result.delta >= 0 ? "text-primary" : "text-error"}`}>
                      {result.delta >= 0 ? "+" : ""}{(result.delta * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Feedback */}
                <p className="text-xs text-text-primary leading-relaxed mb-4 font-body-default">{result.feedback}</p>

                {/* Explanation */}
                <div className="bg-surface-sunken rounded p-4 border border-border-subtle">
                  <p className="text-[10px] font-label-caps text-text-muted mb-2 flex items-center gap-1"><Brain size={12} className="text-primary" /> Full explanation</p>
                  <p className="text-xs text-text-secondary leading-relaxed font-body-default">{result.explanation}</p>
                </div>
              </div>

              <div className="flex gap-3">
                <button id="quiz-next-btn" onClick={fetchQuestion} className="btn-primary flex items-center gap-2">
                  Next Question <Zap size={14} />
                </button>
                <button onClick={() => setPhase("idle")} className="btn-secondary">Finish</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
