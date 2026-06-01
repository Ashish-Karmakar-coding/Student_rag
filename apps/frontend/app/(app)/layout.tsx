/**
 * apps/frontend/app/(app)/layout.tsx
 * Authenticated app shell — sidebar nav + top bar.
 * Wraps all protected pages: /upload, /chat, /dashboard, /quiz, /settings
 */

"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import {
  Brain, Upload, MessageSquare, BarChart3, Zap,
  Settings, LogOut, ChevronLeft, ChevronRight,
  PanelLeftClose, PanelLeft,
} from "lucide-react";
import Image from "next/image";

const NAV_ITEMS = [
  { href: "/chat",      icon: MessageSquare, label: "Chat",      id: "nav-chat" },
  { href: "/quiz",      icon: Zap,           label: "Quiz Me",   id: "nav-quiz" },
  { href: "/dashboard", icon: BarChart3,     label: "Dashboard", id: "nav-dashboard" },
  { href: "/upload",    icon: Upload,        label: "Upload",    id: "nav-upload" },
  { href: "/settings",  icon: Settings,      label: "Settings",  id: "nav-settings" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-[#090910] overflow-hidden">

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <motion.aside
        animate={{ width: collapsed ? 64 : 220 }}
        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        className="flex flex-col border-r border-white/5 bg-[#0d0d18] shrink-0 z-30 overflow-hidden"
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-white/5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-glow-sm shrink-0">
            <Brain size={16} className="text-white" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                className="font-bold text-sm tracking-tight whitespace-nowrap overflow-hidden"
              >
                StudyTutor
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-2 py-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                id={item.id}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${
                  active
                    ? "bg-violet-600/20 text-violet-300 border border-violet-500/20"
                    : "text-white/45 hover:text-white/80 hover:bg-white/[0.04]"
                }`}
              >
                <item.icon size={18} className="shrink-0" />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      className="text-sm font-medium whitespace-nowrap overflow-hidden"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            );
          })}
        </nav>

        {/* User + logout */}
        <div className="px-2 pb-3 border-t border-white/5 pt-3 space-y-1">
          {session?.user && (
            <div className={`flex items-center gap-3 px-3 py-2 rounded-xl ${collapsed ? "justify-center" : ""}`}>
              {session.user.image && (
                <Image
                  src={session.user.image}
                  alt={session.user.name ?? "Avatar"}
                  width={28}
                  height={28}
                  className="rounded-full shrink-0 border border-white/10"
                />
              )}
              <AnimatePresence>
                {!collapsed && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="min-w-0"
                  >
                    <div className="text-xs font-medium text-white/80 truncate">
                      {session.user.name ?? session.user.email}
                    </div>
                    <div className="text-[10px] text-white/35 truncate">
                      {session.user.email}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          <button
            id="nav-logout-btn"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-white/35 hover:text-red-400 hover:bg-red-500/08 transition-all duration-200"
          >
            <LogOut size={16} className="shrink-0" />
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  className="text-sm whitespace-nowrap overflow-hidden"
                >
                  Sign out
                </motion.span>
              )}
            </AnimatePresence>
          </button>

          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-white/25 hover:text-white/60 transition-all"
          >
            {collapsed ? <PanelLeft size={16} className="shrink-0" /> : <PanelLeftClose size={16} className="shrink-0" />}
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  className="text-xs whitespace-nowrap overflow-hidden"
                >
                  Collapse
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </motion.aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto min-w-0">
        {children}
      </main>
    </div>
  );
}
