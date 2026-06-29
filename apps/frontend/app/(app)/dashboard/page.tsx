"use client";
/**
 * apps/frontend/app/(app)/dashboard/page.tsx
 * Mastery dashboard — overall stats, weak concepts, subject breakdown.
 */

import { motion } from "framer-motion";
import { BarChart3, Brain, Flame, Target, TrendingUp, RotateCcw, Loader2, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";
import { useMastery, useMasterySummary, getMasteryColor, getMasteryLabel, invalidateMastery } from "../../../lib/useMastery";
import { resetConcept, deleteFile } from "../../../lib/api";
import { useFiles, invalidateFiles } from "../../../lib/useFiles";

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.35, ease: [0.16, 1, 0.3, 1] } }),
};

export default function DashboardPage() {
  const { mastery, isLoading, revalidate } = useMastery();
  const { summary } = useMasterySummary();
  const { files, isLoading: isLoadingFiles, revalidate: revalidateFiles } = useFiles();

  // Group by subject
  const bySubject = mastery.reduce<Record<string, number[]>>((acc, m) => {
    const key = m.subject ?? "general";
    acc[key] = acc[key] ?? [];
    acc[key]!.push(m.score);
    return acc;
  }, {});

  const handleReset = async (concept: string) => {
    try {
      await resetConcept(concept);
      await invalidateMastery();
      revalidate();
      toast.success(`"${concept}" reset to 50%`);
    } catch { toast.error("Failed to reset concept"); }
  };

  const handleDeleteFile = async (fileName: string) => {
    try {
      await deleteFile(fileName);
      await invalidateFiles();
      revalidateFiles();
      await invalidateMastery();
      revalidate();
      toast.success(`Deleted ${fileName}`);
    } catch { toast.error("Failed to delete file"); }
  };

  const statCards = [
    { icon: Brain, label: "Overall Mastery", value: `${summary.overallPct}%`, sub: `${summary.totalCount} concepts`, color: "text-primary", bg: "border-border-subtle" },
    { icon: Target, label: "Mastered", value: summary.masteredCount, sub: "≥70% score", color: "text-primary", bg: "border-border-subtle" },
    { icon: TrendingUp, label: "Need Work", value: summary.weakCount, sub: "<35% score", color: "text-error", bg: "border-border-subtle" },
    { icon: Flame, label: "Streak", value: `${summary.streakDays}d`, sub: `${summary.sessionsThisWeek} sessions this week`, color: "text-secondary", bg: "border-border-subtle" },
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto bg-surface-base text-text-primary font-body-default min-h-screen">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded bg-surface-raised border border-border-default flex items-center justify-center">
          <BarChart3 size={20} className="text-primary" />
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-tight uppercase">Mastery Dashboard</h1>
          <p className="text-xs text-text-muted font-label-mono">Your learning progress at a glance</p>
        </div>
      </motion.div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map((card, i) => (
          <motion.div key={card.label} custom={i} variants={fadeUp} initial="hidden" animate="visible"
            className={`bg-surface-raised border rounded-lg p-5 flex flex-col justify-between ${card.bg}`}
          >
            <div>
              <card.icon size={18} className={`${card.color} mb-3`} />
              <div className="text-2xl font-black tracking-tight leading-none mb-1">{isLoading ? "—" : card.value}</div>
            </div>
            <div>
              <div className="text-[10px] font-label-caps text-text-secondary">{card.label}</div>
              <div className="text-[9px] font-label-mono text-text-muted mt-0.5">{card.sub}</div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Uploaded Files */}
        <motion.div custom={4} variants={fadeUp} initial="hidden" animate="visible" className="bg-surface-raised border border-border-subtle rounded-lg p-6 flex flex-col">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-border-subtle">
            <h2 className="font-semibold text-xs uppercase tracking-tight flex items-center gap-2">
              <FileText size={14} className="text-primary" />
              Uploaded Files
            </h2>
            <span className="text-[10px] font-label-mono text-text-muted">{files.length} Files</span>
          </div>

          {isLoadingFiles ? (
            <div className="flex-1 flex items-center justify-center py-8"><Loader2 size={20} className="animate-spin text-primary" /></div>
          ) : files.length === 0 ? (
            <p className="text-xs font-label-mono text-text-muted text-center py-12 flex-1 flex items-center justify-center">No files uploaded yet</p>
          ) : (
            <div className="space-y-4">
              {files.map((f) => (
                <div key={f.fileName} className="group border-b border-border-subtle pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-text-primary truncate max-w-[70%]">{f.fileName}</span>
                    <button
                      onClick={() => handleDeleteFile(f.fileName)}
                      className="opacity-0 group-hover:opacity-100 transition-all text-text-muted hover:text-error p-0.5 rounded hover:bg-surface-overlay"
                      title="Delete file"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div className="text-[10px] font-label-caps text-text-secondary capitalize mb-1">
                    Topic: {f.subject}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {f.concepts.slice(0, 5).map(c => (
                      <span key={c} className="px-1.5 py-0.5 rounded-sm text-[9px] font-label-mono font-medium border border-border-subtle bg-surface-overlay text-text-muted">
                        {c}
                      </span>
                    ))}
                    {f.concepts.length > 5 && (
                      <span className="px-1.5 py-0.5 rounded-sm text-[9px] font-label-mono font-medium text-text-muted">
                        +{f.concepts.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Subject breakdown */}
        <motion.div custom={5} variants={fadeUp} initial="hidden" animate="visible" className="bg-surface-raised border border-border-subtle rounded-lg p-6 flex flex-col">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-border-subtle">
            <h2 className="font-semibold text-xs uppercase tracking-tight flex items-center gap-2">
              <Brain size={14} className="text-primary" />
              Subject Breakdown
            </h2>
            <span className="text-[10px] font-label-mono text-text-muted">{Object.keys(bySubject).length} Subjects</span>
          </div>

          {Object.keys(bySubject).length === 0 ? (
            <p className="text-xs font-label-mono text-text-muted text-center py-12 flex-1 flex items-center justify-center">Upload materials to see subject breakdown</p>
          ) : (
            <div className="space-y-4 flex-1">
              {Object.entries(bySubject).map(([subject, scores]) => {
                const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
                const mColor = getMasteryColor(avg);
                return (
                  <div key={subject} className="border-b border-border-subtle pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium capitalize text-text-primary">{subject}</span>
                      <div className="flex items-center gap-2 font-label-mono text-[10px]">
                        <span className="text-text-muted">{scores.length} concepts</span>
                        <span className="font-bold" style={{ color: mColor }}>
                          {Math.round(avg * 100)}%
                        </span>
                      </div>
                    </div>
                    <div className="mastery-bar">
                      <motion.div
                        className="mastery-bar-fill"
                        style={{ backgroundColor: mColor }}
                        initial={{ width: 0 }}
                        animate={{ width: `${avg * 100}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* All concepts list */}
          {mastery.length > 0 && (
            <div className="mt-5 pt-4 border-t border-border-subtle">
              <p className="text-[10px] font-label-caps text-text-muted mb-2.5">All {mastery.length} Concepts</p>
              <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto pr-1">
                {mastery.map((m) => {
                  const mColor = getMasteryColor(m.score);
                  return (
                    <span
                      key={m.concept}
                      className="px-2 py-0.5 rounded-sm text-[10px] font-label-mono font-medium border transition-colors hover:bg-surface-overlay"
                      style={{
                        color: mColor,
                        borderColor: `${mColor}33`, // 20% opacity
                        backgroundColor: "var(--surface-overlay)",
                      }}
                    >
                      {m.concept}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Concepts to review */}
      {mastery.length > 0 && (
        <motion.div custom={6} variants={fadeUp} initial="hidden" animate="visible" className="mt-6 bg-surface-raised border border-border-subtle rounded-lg p-6">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-border-subtle">
            <h2 className="font-semibold text-xs uppercase tracking-tight flex items-center gap-2">
              <Target size={14} className="text-error" />
              Concepts to Review
            </h2>
            <span className="text-[10px] font-label-mono text-text-muted">Weakest first · click <RotateCcw size={10} className="inline" /> to reset</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[...mastery]
              .sort((a, b) => a.score - b.score)
              .slice(0, 8)
              .map((m) => {
                const mColor = getMasteryColor(m.score);
                return (
                  <div key={m.concept} className="group flex items-center gap-3 p-3 rounded border border-border-subtle bg-surface-sunken hover:bg-surface-overlay transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium text-text-primary truncate capitalize">{m.concept}</span>
                        <span className="font-bold text-xs ml-2 shrink-0" style={{ color: mColor }}>
                          {Math.round(m.score * 100)}%
                        </span>
                      </div>
                      <div className="mastery-bar mb-1.5">
                        <motion.div
                          className="mastery-bar-fill"
                          style={{ backgroundColor: mColor }}
                          initial={{ width: 0 }}
                          animate={{ width: `${m.score * 100}%` }}
                          transition={{ duration: 0.5, ease: "easeOut" }}
                        />
                      </div>
                      <div className="flex items-center gap-2 text-[9px] font-label-mono text-text-muted">
                        <span className="capitalize">{m.subject}</span>
                        <span>·</span>
                        <span>{m.attemptCount} attempt{m.attemptCount !== 1 ? "s" : ""}</span>
                        {m.lastTested && (
                          <>
                            <span>·</span>
                            <span>tested {new Date(m.lastTested).toLocaleDateString()}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleReset(m.concept)}
                      title={`Reset "${m.concept}" to 50%`}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-surface-raised text-text-muted hover:text-primary shrink-0"
                    >
                      <RotateCcw size={12} />
                    </button>
                  </div>
                );
              })}
          </div>
        </motion.div>
      )}
    </div>
  );
}
