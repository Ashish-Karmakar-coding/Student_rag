"use client";
/**
 * apps/frontend/app/(app)/dashboard/page.tsx
 * Mastery dashboard — overall stats, weak concepts, subject breakdown.
 */

import { motion } from "framer-motion";
import { BarChart3, Brain, Flame, Target, TrendingUp, RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useMastery, useMasterySummary, getMasteryColor, getMasteryLabel, getWeakConcepts, invalidateMastery } from "../../../lib/useMastery";
import { resetConcept } from "../../../lib/api";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.4 } }),
};

export default function DashboardPage() {
  const { mastery, isLoading, revalidate } = useMastery();
  const { summary } = useMasterySummary();
  const weak = getWeakConcepts(mastery, 8);

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

  const statCards = [
    { icon: Brain, label: "Overall Mastery", value: `${summary.overallPct}%`, sub: `${summary.totalCount} concepts`, color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20" },
    { icon: Target, label: "Mastered", value: summary.masteredCount, sub: "≥70% score", color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
    { icon: TrendingUp, label: "Need Work", value: summary.weakCount, sub: "<35% score", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
    { icon: Flame, label: "Streak", value: `${summary.streakDays}d`, sub: `${summary.sessionsThisWeek} sessions this week`, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600/30 to-indigo-700/20 border border-violet-500/25 flex items-center justify-center">
          <BarChart3 size={20} className="text-violet-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Mastery Dashboard</h1>
          <p className="text-sm text-white/40">Your learning progress at a glance</p>
        </div>
      </motion.div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((card, i) => (
          <motion.div key={card.label} custom={i} variants={fadeUp} initial="hidden" animate="visible"
            className={`glass p-5 rounded-2xl border ${card.bg}`}
          >
            <card.icon size={20} className={`${card.color} mb-3`} />
            <div className={`text-2xl font-black ${card.color}`}>{isLoading ? "—" : card.value}</div>
            <div className="text-xs font-semibold text-white/70 mt-0.5">{card.label}</div>
            <div className="text-[10px] text-white/30 mt-0.5">{card.sub}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weak concepts */}
        <motion.div custom={4} variants={fadeUp} initial="hidden" animate="visible" className="glass p-6 rounded-2xl">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Target size={16} className="text-red-400" />
            Needs Attention
          </h2>
          {isLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 size={24} className="animate-spin text-violet-400" /></div>
          ) : weak.length === 0 ? (
            <p className="text-sm text-white/30 text-center py-6">No concepts yet — upload study materials to begin</p>
          ) : (
            <div className="space-y-3">
              {weak.map((m) => (
                <div key={m.concept} className="group">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm text-white/75 truncate">{m.concept}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold" style={{ color: getMasteryColor(m.score) }}>
                        {Math.round(m.score * 100)}%
                      </span>
                      <button
                        id={`reset-${m.concept.replace(/\s+/g, "-")}-btn`}
                        onClick={() => handleReset(m.concept)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-white/25 hover:text-violet-400"
                        title="Reset mastery"
                      >
                        <RotateCcw size={12} />
                      </button>
                    </div>
                  </div>
                  <div className="mastery-bar">
                    <motion.div
                      className="mastery-bar-fill"
                      style={{ background: getMasteryColor(m.score) }}
                      initial={{ width: 0 }}
                      animate={{ width: `${m.score * 100}%` }}
                      transition={{ duration: 0.6, delay: 0.2 }}
                    />
                  </div>
                  <div className="text-[10px] text-white/25 mt-1">
                    {m.attemptCount} attempts · {getMasteryLabel(m.score)}
                    {m.lastTested && ` · Last tested ${new Date(m.lastTested).toLocaleDateString()}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Subject breakdown */}
        <motion.div custom={5} variants={fadeUp} initial="hidden" animate="visible" className="glass p-6 rounded-2xl">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Brain size={16} className="text-violet-400" />
            Subject Breakdown
          </h2>
          {Object.keys(bySubject).length === 0 ? (
            <p className="text-sm text-white/30 text-center py-6">Upload materials to see subject breakdown</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(bySubject).map(([subject, scores]) => {
                const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
                return (
                  <div key={subject}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium capitalize text-white/80">{subject}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-white/35">{scores.length} concepts</span>
                        <span className="text-xs font-bold" style={{ color: getMasteryColor(avg) }}>
                          {Math.round(avg * 100)}%
                        </span>
                      </div>
                    </div>
                    <div className="mastery-bar">
                      <motion.div
                        className="mastery-bar-fill"
                        style={{ background: `linear-gradient(90deg, ${getMasteryColor(avg)}, ${getMasteryColor(avg)}88)` }}
                        initial={{ width: 0 }}
                        animate={{ width: `${avg * 100}%` }}
                        transition={{ duration: 0.7, delay: 0.3 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* All concepts list */}
          {mastery.length > 0 && (
            <div className="mt-5 pt-4 border-t border-white/5">
              <p className="text-xs text-white/35 mb-2">All {mastery.length} concepts</p>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                {mastery.map((m) => (
                  <span
                    key={m.concept}
                    className="px-2 py-0.5 rounded-full text-[10px] font-medium border"
                    style={{
                      color: getMasteryColor(m.score),
                      borderColor: `${getMasteryColor(m.score)}30`,
                      background: `${getMasteryColor(m.score)}10`,
                    }}
                  >
                    {m.concept}
                  </span>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
