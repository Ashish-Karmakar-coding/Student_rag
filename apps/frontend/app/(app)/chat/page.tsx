"use client";
/**
 * apps/frontend/app/(app)/chat/page.tsx
 * Full chat interface with SSE streaming, session sidebar, mode toggle.
 */

import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
    <div className="flex h-screen bg-surface-base text-text-primary font-body-default">
      {/* ── Session sidebar ─────────────────────────────────────────────── */}
      <div className="w-56 shrink-0 border-r border-border-subtle bg-surface-raised flex flex-col">
        <div className="p-4 border-b border-border-subtle flex items-center justify-between shrink-0">
          <span className="text-[10px] font-label-caps text-text-muted">History</span>
          <button
            onClick={() => { clearMessages(); setActiveSessionId(null); }}
            className="text-xs font-semibold text-primary hover:text-text-primary transition-colors"
          >
            New chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {sessions.length === 0 && (
            <p className="text-xs font-label-mono text-text-muted text-center mt-6 px-3">No sessions yet. Start chatting!</p>
          )}
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => loadSession(s.id)}
              className="w-full text-left px-3 py-2 rounded hover:bg-surface-overlay border border-transparent hover:border-border-subtle transition-all duration-150 group flex items-start justify-between gap-2"
            >
              <div className="min-w-0">
                <div className="text-xs font-medium text-text-primary truncate capitalize">{s.subject}</div>
                <div className="text-[9px] font-label-mono text-text-muted mt-0.5">
                  {new Date(s.updatedAt).toLocaleDateString()}
                </div>
              </div>
              <button
                onClick={(e) => handleDeleteSession(s.id, e)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-text-muted hover:text-red-400 shrink-0 mt-0.5"
              >
                <Trash2 size={12} />
              </button>
            </button>
          ))}
        </div>
      </div>

      {/* ── Main chat area ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 bg-surface-base">
        {/* Top bar */}
        <div className="border-b border-border-subtle px-6 py-4 flex items-center justify-between bg-surface-raised/90 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-2">
            <Brain size={16} className="text-primary animate-pulse" />
            <span className="font-semibold text-xs tracking-tight text-text-primary">Study Chat</span>
          </div>

          {/* Mode toggle */}
          <div className="flex items-center gap-1 p-0.5 bg-surface-sunken rounded border border-border-subtle">
            {(["explain", "quiz"] as const).map((mode) => (
              <button
                key={mode}
                id={`mode-${mode}-btn`}
                onClick={() => setActiveMode(mode)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-semibold transition-all ${
                  activeMode === mode
                    ? "bg-primary text-surface-base"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                {mode === "explain" ? <BookOpen size={12} /> : <Zap size={12} />}
                {mode === "explain" ? "Explain" : "Quiz Me"}
              </button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          {messages.length === 0 && !loadingSession && (
            <div className="h-full flex flex-col items-center justify-center text-center py-20">
              <div className="w-12 h-12 rounded bg-surface-sunken border border-border-default flex items-center justify-center mb-4 shrink-0">
                <MessageSquare size={20} className="text-primary" />
              </div>
              <h2 className="text-sm font-semibold text-text-primary mb-1">Ask anything about your materials</h2>
              <p className="text-xs text-text-muted max-w-xs font-body-default">
                Upload your notes first, then ask questions or switch to Quiz mode.
              </p>
            </div>
          )}

          {loadingSession && (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={20} className="text-primary animate-spin" />
            </div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div
                key={`${i}-${msg.timestamp}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div className={`max-w-[80%] ${msg.role === "user" ? "order-2" : "order-1"}`}>
                  {msg.role === "user" ? (
                    <div className="bg-surface-sunken border border-border-default rounded-lg rounded-tr-sm px-4 py-2.5 text-xs text-text-primary leading-relaxed font-body-default">
                      {msg.text}
                    </div>
                  ) : (
                    <div className="bg-surface-raised border border-border-subtle rounded-lg rounded-tl-sm px-5 py-4">
                      {msg.isStreaming && msg.text === "" ? (
                        <div className="flex items-center gap-1 py-1">
                          <div className="typing-dot" />
                          <div className="typing-dot" />
                          <div className="typing-dot" />
                        </div>
                      ) : (
                        <div className="prose-dark text-xs text-text-primary whitespace-pre-wrap leading-relaxed">
                          {msg.text}
                          {msg.isStreaming && <span className="inline-block w-1.5 h-3.5 bg-primary ml-0.5 animate-pulse align-middle" />}
                        </div>
                      )}

                      {/* Concept tags */}
                      {!msg.isStreaming && msg.conceptTags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-border-subtle">
                          {msg.conceptTags.slice(0, 6).map((tag) => (
                            <span key={tag} className="concept-pill">{tag}</span>
                          ))}
                        </div>
                      )}

                      {/* Sources */}
                      {!msg.isStreaming && msg.sources.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {msg.sources.slice(0, 3).map((src, j) => (
                            <div key={j} className="flex items-center gap-1 px-2 py-0.5 rounded bg-surface-sunken border border-border-subtle text-[10px] font-label-mono text-text-muted">
                              <FileText size={10} className="text-primary shrink-0" />
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
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 px-4 py-2.5 rounded bg-surface-raised border border-border-default text-xs font-body-default"
              >
                <Lightbulb size={13} className="text-secondary shrink-0" />
                <span className="text-text-muted">
                  Focus suggestion: <span className="text-text-primary font-medium">{masteryHint.weakConcept}</span>{" "}
                  — current mastery{" "}
                  <span style={{ color: getMasteryColor(masteryHint.score) }} className="font-semibold">
                    {Math.round(masteryHint.score * 100)}%
                  </span>
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border-subtle px-6 py-4 bg-surface-raised/95 shrink-0">
          <div className="flex items-end gap-3">
            <textarea
              ref={textareaRef}
              id="chat-input"
              rows={1}
              value={query}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder={activeMode === "explain" ? "Ask about your study materials…" : "Request a quiz question…"}
              className="input-field flex-1 resize-none min-h-[42px] max-h-[160px] py-2.5 leading-relaxed"
              disabled={isStreaming}
            />
            <button
              id="chat-send-btn"
              onClick={isStreaming ? stop : handleSend}
              disabled={!isStreaming && !query.trim()}
              className={`shrink-0 w-10.5 h-10.5 rounded flex items-center justify-center transition-all ${
                isStreaming
                  ? "bg-surface-sunken border border-error text-error hover:bg-error/10"
                  : "btn-primary p-0 w-10.5 h-10.5 disabled:opacity-40"
              }`}
            >
              {isStreaming ? <StopCircle size={16} /> : <Send size={16} />}
            </button>
          </div>
          <p className="text-[10px] font-label-mono text-text-muted mt-2">
            {activeMode === "explain" ? "Explain mode — context-grounded answers" : "Quiz mode — Socratic questions based on your weak spots"}
            {" · "}Enter to send · Shift+Enter for newline
          </p>
        </div>
      </div>
    </div>
  );
}
