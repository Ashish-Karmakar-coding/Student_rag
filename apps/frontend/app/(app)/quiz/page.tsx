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
  AlertTriangle, Settings,
} from "lucide-react";
import Link from "next/link";
import { getNextQuestion, submitAnswer, getNextQuestionContext, submitQuizScoreUpdate } from "../../../lib/api";
import { ollamaComplete } from "../../../lib/useOllama";
import { getMasteryColor, invalidateMastery, useMastery } from "../../../lib/useMastery";
import { useFiles } from "../../../lib/useFiles";
import { useSettings } from "../../../lib/useSettings";
import type { QuizNextResponse, QuizAnswerResponse } from "@study-tutor/shared";

// Local state for Ollama context passing
let _ollamaChunks: any[] = [];

type Phase = "idle" | "loading-q" | "question" | "answering" | "evaluating" | "result";

export default function QuizPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [question, setQuestion] = useState<QuizNextResponse | null>(null);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<QuizAnswerResponse | null>(null);
  const [hintVisible, setHintVisible] = useState(false);

  const [selectedFile, setSelectedFile] = useState("");

  const { files } = useFiles();
  const { settings } = useSettings();

  const isOllamaProvider = settings?.provider === "ollama";
  const ollamaUrl = settings?.ollamaUrl ?? "http://localhost:11434";

  // With direct browser-to-localhost, localhost is fully supported.
  const providerReady = true;

  const fetchQuestion = async () => {
    setPhase("loading-q");
    setAnswer("");
    setResult(null);
    setHintVisible(false);
    try {
      const params: any = {};
      if (selectedFile) params.fileName = selectedFile;
      
      if (isOllamaProvider) {
        // Codexa approach: retrieve context, then generate prompt locally
        const contextData = await getNextQuestionContext(params);
        _ollamaChunks = contextData.chunks;
        
        const contextText = _ollamaChunks.slice(0, 4)
          .map((c, i) => `[${i + 1}] ${c.text}`)
          .join("\n\n---\n\n");
          
        const prompt = `Context from study materials:\n${contextText}\n\n---\n\nTarget concept: "${contextData.concept}"\nStudent mastery: ${Math.round(contextData.masteryBefore * 100)}%\nDifficulty tier: ${contextData.difficulty}\n\nGenerate ONE Socratic guiding question about "${contextData.concept}" at the ${contextData.difficulty} level.\nThe question should help the student think through the concept.\n\nFormat your response as:\nQuestion: [your single question here]\nHint: [a subtle nudge, no more than one sentence]`;
        
        const raw = await ollamaComplete(
          prompt, 
          "You are a Socratic tutor. Your job is to help students discover knowledge through guided questioning.\n\nRules:\n- NEVER give the answer directly\n- Ask exactly ONE guiding question per response\n- The question should lead the student to reason through the concept themselves\n- Use the provided context as the basis for your question\n- Match the difficulty level specified\n- Make the question specific, not vague\n- End with a \"Hint:\" line that gives a subtle nudge without revealing the answer", 
          settings?.model || "llama3",
          ollamaUrl
        );
        
        const questionMatch = raw.match(/Question:\s*(.+?)(?=Hint:|$)/si);
        const hintMatch = raw.match(/Hint:\s*(.+?)$/si);
        const qText = questionMatch?.[1]?.trim() ?? raw.trim();
        const hint = hintMatch?.[1]?.trim() ?? "Think about the underlying mechanism.";
        
        setQuestion({
          questionId: "local-" + Date.now(),
          question: qText,
          concept: contextData.concept,
          masteryBefore: contextData.masteryBefore,
          difficulty: contextData.difficulty,
          hint,
          sources: contextData.sources,
        });
      } else {
        const q = await getNextQuestion(params);
        setQuestion(q);
      }
      setPhase("question");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to get question";
      if (msg.toLowerCase().includes("not reachable") || msg.toLowerCase().includes("provider unavailable")) {
        toast.error("LLM provider not reachable. Go to Settings → switch to OpenAI or Anthropic.", { duration: 8000 });
      } else {
        toast.error(msg);
      }
      setPhase("idle");
    }
  };

  const handleSubmit = async () => {
    if (!answer.trim() || !question) return;
    setPhase("evaluating");
    try {
      let res: QuizAnswerResponse;
      
      if (isOllamaProvider) {
        // Codexa approach: evaluate locally, then send score to backend
        const contextText = _ollamaChunks.slice(0, 4)
          .map((c, i) => `[${i + 1}] ${c.text}`)
          .join("\n\n---\n\n");
          
        const prompt = `Context from study materials:\n${contextText}\n\n---\n\nQuestion asked to student: ${question.question}\n\nStudent's answer: ${answer.trim()}\n\nEvaluate how correct the student's answer is based on the context.\nReturn ONLY valid JSON (no markdown):\n{"score": 0.0-1.0, "feedback": "constructive feedback", "explanation": "complete correct answer"}`;
        
        const raw = await ollamaComplete(
          prompt, 
          "You are an academic answer evaluator.\nYour task is to assess how correct a student's answer is.\n\nRules:\n- Return ONLY valid JSON, no markdown fences, no explanation outside JSON\n- score: a decimal from 0.0 (completely wrong) to 1.0 (perfectly correct)\n- feedback: 1–2 sentences of constructive feedback for the student\n- explanation: the complete correct answer based on the provided context\n- Be fair but accurate — partial credit is fine (e.g. 0.6 for mostly correct)\n- JSON format: {\"score\": 0.8, \"feedback\": \"...\", \"explanation\": \"...\"}", 
          settings?.model || "llama3",
          ollamaUrl
        );
        
        let parsed: any;
        try {
          const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
          const match = cleaned.match(/\{[\s\S]*?\}/);
          if (!match) throw new Error("No JSON");
          parsed = JSON.parse(match[0]);
        } catch {
          parsed = { score: 0.5, feedback: "Unable to evaluate automatically.", explanation: "Check study materials." };
        }
        
        const updateRes = await submitQuizScoreUpdate(question.concept, question.masteryBefore, parsed.score);
        res = {
          score: parsed.score,
          feedback: parsed.feedback || "Good attempt.",
          explanation: parsed.explanation || "Refer to context.",
          masteryBefore: question.masteryBefore,
          masteryAfter: updateRes.masteryAfter,
          delta: updateRes.delta,
        };
      } else {
        res = await submitAnswer(question.questionId, answer.trim());
      }
      
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

              {/* ── Provider warning (removed since localhost works directly) ── */}              <div className="max-w-xs mx-auto mb-8 text-left">
                <label className="text-[10px] font-label-caps text-text-muted mb-2 block">Select Project (PDF)</label>
                {files.length === 0 ? (
                  <div className="text-xs text-text-muted text-center py-4 bg-surface-sunken rounded border border-border-subtle">
                    No projects found. Upload a file first!
                  </div>
                ) : (
                  <select 
                    className="input-field w-full"
                    value={selectedFile}
                    onChange={(e) => setSelectedFile(e.target.value)}
                  >
                    <option value="" disabled>Choose a project...</option>
                    {files.map(f => <option key={f.fileName} value={f.fileName}>{f.fileName}</option>)}
                  </select>
                )}
              </div>

              <button 
                id="quiz-start-btn" 
                onClick={fetchQuestion} 
                disabled={!selectedFile || files.length === 0 || !providerReady}
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
