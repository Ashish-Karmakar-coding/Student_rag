/**
 * apps/frontend/app/(app)/layout.tsx
 * Authenticated app shell — sidebar nav + top bar + Command Bar modal.
 * Wraps all protected pages: /upload, /chat, /dashboard, /quiz, /settings
 */

"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
  Brain, Upload, MessageSquare, BarChart3, Zap,
  Settings, LogOut, PanelLeftClose, PanelLeft, Search, Command
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
  const router = useRouter();
  const { data: session, status } = useSession();
  const [collapsed, setCollapsed] = useState(false);
  const [synced, setSynced] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Proactively sync user session with backend if logged in
  useEffect(() => {
    if (status === "authenticated" && session && !synced && !syncing) {
      setSyncing(true);
      axios.post("/api/sync-user")
        .then(() => {
          setSynced(true);
        })
        .catch((err) => {
          console.error("[AppLayout] Failed to sync user session with backend:", err);
        })
        .finally(() => {
          setSyncing(false);
        });
    }
  }, [status, session, synced, syncing]);

  // Command Bar State
  const [commandBarOpen, setCommandBarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const commandInputRef = useRef<HTMLInputElement>(null);

  const commands = [
    { id: "chat", title: "Go to Chat", description: "Open the adaptive AI tutor chat interface", href: "/chat", icon: MessageSquare },
    { id: "quiz", title: "Go to Quiz Me", description: "Start a Socratic quiz session", href: "/quiz", icon: Zap },
    { id: "dashboard", title: "Go to Dashboard", description: "View concept mastery and stats", href: "/dashboard", icon: BarChart3 },
    { id: "upload", title: "Go to Upload Materials", description: "Process new PDFs, Markdown, and notes", href: "/upload", icon: Upload },
    { id: "settings", title: "Go to Settings", description: "Configure model provider and credentials", href: "/settings", icon: Settings },
    { id: "toggle-sidebar", title: "Toggle Sidebar", description: "Collapse or expand sidebar navigation", action: "toggle-sidebar", icon: PanelLeft },
    { id: "sign-out", title: "Sign Out", description: "Log out of your StudyTutor account", action: "sign-out", icon: LogOut },
  ];

  // Filtered commands list
  const filteredCommands = commands.filter(c =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle Command Bar
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandBarOpen(open => !open);
        setSearchQuery("");
        setSelectedIndex(0);
      }

      // Close on Escape
      if (e.key === "Escape" && commandBarOpen) {
        e.preventDefault();
        setCommandBarOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [commandBarOpen]);

  // Focus command bar input when opened
  useEffect(() => {
    if (commandBarOpen) {
      setTimeout(() => commandInputRef.current?.focus(), 50);
    }
  }, [commandBarOpen]);

  // Handle keyboard navigation inside Command Bar
  const handleCommandKeyDown = (e: React.KeyboardEvent) => {
    if (!commandBarOpen || filteredCommands.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      triggerCommand(filteredCommands[selectedIndex]!);
    }
  };

  const triggerCommand = (cmd: typeof commands[0]) => {
    setCommandBarOpen(false);
    if (cmd.href) {
      router.push(cmd.href);
    } else if (cmd.action === "toggle-sidebar") {
      setCollapsed(!collapsed);
    } else if (cmd.action === "sign-out") {
      signOut({ callbackUrl: "/" });
    }
  };

  return (
    <div className="flex h-screen bg-surface-base text-text-primary overflow-hidden font-body-default">

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <motion.aside
        animate={{ width: collapsed ? 64 : 220 }}
        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        className="flex flex-col border-r border-border-subtle bg-surface-raised shrink-0 z-30 overflow-hidden"
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-border-subtle shrink-0">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center shrink-0">
            <Brain size={16} className="text-surface-base" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                className="font-headline-lg font-bold text-[14px] tracking-tight whitespace-nowrap overflow-hidden text-text-primary"
              >
                StudyTutor
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Global Command Bar trigger button */}
        <div className="px-2 pt-3 pb-1">
          <button
            onClick={() => { setCommandBarOpen(true); setSearchQuery(""); setSelectedIndex(0); }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded bg-surface-sunken border border-border-subtle hover:border-border-default text-text-muted hover:text-text-secondary transition-all ${
              collapsed ? "justify-center" : ""
            }`}
            title="Search commands (Ctrl+K)"
          >
            <Search size={14} className="shrink-0" />
            {!collapsed && (
              <div className="flex items-center justify-between flex-1">
                <span className="text-xs font-label-mono">Search…</span>
                <span className="text-[9px] font-label-mono bg-surface-overlay px-1 py-0.5 rounded border border-border-subtle text-text-muted">⌘K</span>
              </div>
            )}
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                id={item.id}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded transition-all duration-150 group border ${
                  active
                    ? "bg-surface-overlay text-primary border-border-default font-medium"
                    : "text-text-muted hover:text-text-primary hover:bg-surface-overlay border-transparent hover:border-border-subtle"
                }`}
              >
                <item.icon size={16} className={`shrink-0 ${active ? "text-primary" : "text-text-muted group-hover:text-text-primary"}`} />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      className="text-xs whitespace-nowrap overflow-hidden"
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
        <div className="px-2 pb-3 border-t border-border-subtle pt-3 space-y-1 shrink-0">
          {session?.user && (
            <div className={`flex items-center gap-3 px-3 py-2 rounded ${collapsed ? "justify-center" : ""}`}>
              {session.user.image && (
                <Image
                  src={session.user.image}
                  alt={session.user.name ?? "Avatar"}
                  width={24}
                  height={24}
                  className="rounded-full shrink-0 border border-border-default"
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
                    <div className="text-[11px] font-semibold text-text-primary truncate">
                      {session.user.name ?? session.user.email}
                    </div>
                    <div className="text-[9px] font-label-mono text-text-muted truncate">
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
            className="w-full flex items-center gap-3 px-3 py-2 rounded text-text-muted hover:text-red-400 hover:bg-surface-overlay border border-transparent hover:border-border-subtle transition-all duration-150"
          >
            <LogOut size={14} className="shrink-0" />
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  className="text-xs whitespace-nowrap overflow-hidden"
                >
                  Sign out
                </motion.span>
              )}
            </AnimatePresence>
          </button>

          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded text-text-muted hover:text-text-primary hover:bg-surface-overlay border border-transparent hover:border-border-subtle transition-all"
          >
            {collapsed ? <PanelLeft size={14} className="shrink-0" /> : <PanelLeftClose size={14} className="shrink-0" />}
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  className="text-[10px] whitespace-nowrap overflow-hidden font-label-mono"
                >
                  Collapse
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </motion.aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto min-w-0 bg-surface-base">
        {children}
      </main>

      {/* ── The Command Bar Modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {commandBarOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setCommandBarOpen(false)}
              className="absolute inset-0 bg-[#000000]"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full max-w-[560px] bg-surface-overlay border border-border-default rounded-lg shadow-hard-modal overflow-hidden flex flex-col z-10"
            >
              {/* Search Header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle bg-surface-sunken">
                <Command size={16} className="text-primary shrink-0" />
                <input
                  ref={commandInputRef}
                  type="text"
                  placeholder="Type a command or search…"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setSelectedIndex(0); }}
                  onKeyDown={handleCommandKeyDown}
                  className="w-full bg-transparent border-none outline-none font-label-mono text-xs text-text-primary placeholder-text-muted"
                />
                <span className="text-[10px] font-label-mono border border-border-subtle px-1.5 py-0.5 rounded text-text-muted shrink-0">ESC</span>
              </div>

              {/* Commands List */}
              <div className="max-h-[320px] overflow-y-auto p-2 space-y-0.5">
                {filteredCommands.length === 0 ? (
                  <p className="text-xs font-label-mono text-text-muted text-center py-6">No matching commands found.</p>
                ) : (
                  filteredCommands.map((cmd, index) => {
                    const isSelected = index === selectedIndex;
                    const Icon = cmd.icon;
                    return (
                      <button
                        key={cmd.id}
                        onClick={() => triggerCommand(cmd)}
                        onMouseEnter={() => setSelectedIndex(index)}
                        className={`w-full flex items-center justify-between text-left p-3 rounded transition-all border ${
                          isSelected
                            ? "bg-surface-raised border-border-default text-text-primary"
                            : "bg-transparent border-transparent text-text-muted"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Icon size={14} className={isSelected ? "text-primary" : "text-text-muted"} />
                          <div className="min-w-0">
                            <div className="text-xs font-medium">{cmd.title}</div>
                            <div className="text-[10px] text-text-muted truncate mt-0.5">{cmd.description}</div>
                          </div>
                        </div>
                        {isSelected && (
                          <span className="text-[9px] font-label-mono bg-surface-sunken px-1.5 py-0.5 rounded border border-border-subtle text-primary">
                            Enter
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              {/* Footer info bar */}
              <div className="px-4 py-2 border-t border-border-subtle text-[10px] font-label-mono text-text-muted flex items-center justify-between bg-surface-sunken/40">
                <span>Use arrows <kbd className="bg-surface-raised px-1 border border-border-subtle rounded">↑</kbd> <kbd className="bg-surface-raised px-1 border border-border-subtle rounded">↓</kbd> to navigate</span>
                <span>Select to execute</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
