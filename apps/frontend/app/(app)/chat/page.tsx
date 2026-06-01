"use client";
/**
 * apps/frontend/app/(app)/chat/page.tsx
 * Full chat interface with SSE streaming, session sidebar, mode toggle.
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Send, Zap, BookOpen, Brain, StopCircle,
  MessageSquare, Trash2, ChevronRight, Loader2,
  FileText, Lightbulb,
} from "lucide-react";
import { useStream } from "../../../lib/useStream";
import { useAppStore } from "../../../lib/store";
import { getSessions, getSession, deleteSession } from "../../../lib/api";
import { getMasteryColor } from "../../../lib/useMastery";
import type { SessionListItem } from "@study-tutor/shared";

export default function ChatPage() {
  const [query, setQuery] = useState("");
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [loadingSession, setLoadingSession] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const messages = useAppStore((s) => s.messages);
  const clearMessages = useAppStore((s) => s.clearMessages);
  const setMessages = useAppStore((s) => s.setMessages);
  const activeMode = useAppStore((s) => s.activeMode);
  const setActiveMode = useAppStore((s) => s.setActiveMode);
  const setActiveSessionId = useAppStore((s) => s.setActiveSessionId);

  const { isStreaming, masteryHint, startStream, stop } = useStream({
    onError: (msg) => toast.error(msg),
  });

  // Load session list
  useEffect(() => {
    getSessions().then(setSessions).catch(() => {});
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setQuery(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
  };

  const handleSend = async () => {
    const q = query.trim();
    if (!q || isStreaming) return;
    setQuery("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    await startStream(q, activeMode);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const loadSession = async (id: string) => {
    setLoadingSession(true);
    try {
      const detail = await getSession(id);
      setActiveSessionId(id);
      setMessages(
        detail.messages.map((m) => ({
          role: m.role,
          text: m.text,
          isStreaming: false,
          conceptTags: m.conceptTags,
          sources: m.sources,
          timestamp: m.timestamp,
        }))
      );
    } catch { toast.error("Failed to load session"); }
    finally { setLoadingSession(false); }
  };

  const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteSession(id).catch(() => {});
    setSessions((s) => s.filter((sess) => sess.id !== id));
    toast.success("Session deleted");
  };

  return (
    <div className="flex h-screen">
      {/* ── Session sidebar ─────────────────────────────────────────────── */}
      <div className="w-60 shrink-0 border-r border-white/5 bg-[#0d0d18] flex flex-col">
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <span className="text-sm font-semibold text-white/60">History</span>
          <button
            onClick={() => { clearMessages(); setActiveSessionId(null); }}
            className="text-xs text-white/30 hover:text-violet-400 transition-colors"
          >
            New chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
          {sessions.length === 0 && (
            <p className="text-xs text-white/25 text-center mt-6 px-3">No sessions yet. Start chatting!</p>
          )}
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => loadSession(s.id)}
              className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-white/[0.04] transition-colors group flex items-start justify-between gap-2"
            >
              <div className="min-w-0">
                <div className="text-xs font-medium text-white/70 truncate capitalize">{s.subject}</div>
                <div className="text-[10px] text-white/30 mt-0.5">
                  {new Date(s.updatedAt).toLocaleDateString()}
                </div>
              </div>
              <button
                onClick={(e) => handleDeleteSession(s.id, e)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-white/20 hover:text-red-400 shrink-0 mt-0.5"
              >
                <Trash2 size={12} />
              </button>
            </button>
          ))}
        </div>
      </div>

      {/* ── Main chat area ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="border-b border-white/5 px-6 py-4 flex items-center justify-between bg-[#0d0d18]/80 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <Brain size={18} className="text-violet-400" />
            <span className="font-semibold text-sm">Study Chat</span>
          </div>

          {/* Mode toggle */}
          <div className="flex items-center gap-1 p-1 bg-white/[0.04] rounded-xl border border-white/[0.06]">
            {(["explain", "quiz"] as const).map((mode) => (
              <button
                key={mode}
                id={`mode-${mode}-btn`}
                onClick={() => setActiveMode(mode)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeMode === mode
                    ? "bg-violet-600 text-white shadow-glow-sm"
                    : "text-white/40 hover:text-white/70"
                }`}
              >
                {mode === "explain" ? <BookOpen size={13} /> : <Zap size={13} />}
                {mode === "explain" ? "Explain" : "Quiz Me"}
              </button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
          {messages.length === 0 && !loadingSession && (
            <div className="h-full flex flex-col items-center justify-center text-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-5">
                <MessageSquare size={28} className="text-violet-400" />
              </div>
              <h2 className="text-lg font-semibold mb-2">Ask anything about your materials</h2>
              <p className="text-sm text-white/35 max-w-xs">
                Upload your notes first, then ask questions or switch to Quiz mode.
              </p>
            </div>
          )}

          {loadingSession && (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={24} className="text-violet-400 animate-spin" />
            </div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div
                key={`${i}-${msg.timestamp}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div className={`max-w-[75%] ${msg.role === "user" ? "order-2" : "order-1"}`}>
                  {msg.role === "user" ? (
                    <div className="bg-violet-600/25 border border-violet-500/25 rounded-2xl rounded-tr-sm px-4 py-3 text-sm text-white/90">
                      {msg.text}
                    </div>
                  ) : (
                    <div className="glass rounded-2xl rounded-tl-sm px-5 py-4">
                      {msg.isStreaming && msg.text === "" ? (
                        <div className="flex items-center gap-1 py-1">
                          <div className="typing-dot" />
                          <div className="typing-dot" />
                          <div className="typing-dot" />
                        </div>
                      ) : (
                        <div className="prose-dark text-sm text-white/85 whitespace-pre-wrap leading-relaxed">
                          {msg.text}
                          {msg.isStreaming && <span className="inline-block w-0.5 h-4 bg-violet-400 ml-0.5 animate-pulse align-middle" />}
                        </div>
                      )}

                      {/* Concept tags */}
                      {!msg.isStreaming && msg.conceptTags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-white/5">
                          {msg.conceptTags.slice(0, 6).map((tag) => (
                            <span key={tag} className="concept-pill">{tag}</span>
                          ))}
                        </div>
                      )}

                      {/* Sources */}
                      {!msg.isStreaming && msg.sources.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {msg.sources.slice(0, 3).map((src, j) => (
                            <div key={j} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[10px] text-white/30">
                              <FileText size={10} />
                              <span className="truncate max-w-[100px]">{src.fileName}</span>
                              {src.page && <span>p.{src.page}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Mastery hint */}
          <AnimatePresence>
            {masteryHint && !isStreaming && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/8 border border-amber-500/15 text-xs"
              >
                <Lightbulb size={14} className="text-amber-400 shrink-0" />
                <span className="text-white/50">
                  Weak concept: <span className="text-amber-300 font-medium">{masteryHint.weakConcept}</span>{" "}
                  — mastery{" "}
                  <span style={{ color: getMasteryColor(masteryHint.score) }}>
                    {Math.round(masteryHint.score * 100)}%
                  </span>
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-white/5 px-6 py-4 bg-[#0d0d18]/60 backdrop-blur-sm">
          <div className="flex items-end gap-3">
            <textarea
              ref={textareaRef}
              id="chat-input"
              rows={1}
              value={query}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder={activeMode === "explain" ? "Ask about your study materials…" : "Request a quiz question…"}
              className="input-field flex-1 resize-none min-h-[44px] max-h-[160px] py-3 leading-relaxed"
              disabled={isStreaming}
            />
            <button
              id="chat-send-btn"
              onClick={isStreaming ? stop : handleSend}
              disabled={!isStreaming && !query.trim()}
              className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
                isStreaming
                  ? "bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30"
                  : "btn-primary p-0 w-11 h-11 disabled:opacity-40"
              }`}
            >
              {isStreaming ? <StopCircle size={18} /> : <Send size={18} />}
            </button>
          </div>
          <p className="text-[10px] text-white/20 mt-2">
            {activeMode === "explain" ? "Explain mode — context-grounded answers" : "Quiz mode — Socratic questions based on your weak spots"}
            {" · "}Enter to send · Shift+Enter for newline
          </p>
        </div>
      </div>
    </div>
  );
}
