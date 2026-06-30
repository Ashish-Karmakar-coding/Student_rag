"use client";
/**
 * apps/frontend/app/(app)/settings/page.tsx
 * Provider configuration — model, API key management, connection test.
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Settings, Loader2, CheckCircle2, XCircle,
  Eye, EyeOff, Trash2, Zap, Key, Server, AlertTriangle, ExternalLink,
} from "lucide-react";
import { getSettings, patchSettings, saveApiKey, deleteApiKey, testProvider } from "../../../lib/api";
import { ollamaComplete, pingOllama } from "../../../lib/useOllama";

type Provider = "ollama" | "openai" | "anthropic";

const PROVIDERS: {
  value: Provider;
  label: string;
  badge: string;
  badgeColor: string;
  models: string[];
  localOnly: boolean;
}[] = [
  {
    value: "ollama",
    label: "Ollama",
    badge: "Local + Tunnel",
    badgeColor: "text-amber-400",
    models: ["llama3", "llama3.1", "llama3.2", "mistral", "phi3", "gemma2", "qwen2.5", "deepseek-r1"],
    localOnly: true,
  },
  {
    value: "openai",
    label: "OpenAI",
    badge: "Cloud ✓",
    badgeColor: "",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"],
    localOnly: false,
  },
  {
    value: "anthropic",
    label: "Anthropic",
    badge: "Cloud ✓",
    badgeColor: "",
    models: ["claude-3-5-sonnet-20241022", "claude-3-haiku-20240307", "claude-3-opus-20240229"],
    localOnly: false,
  },
];

/** Returns true if the URL points to localhost / 127.0.0.1 */
function isLocalhost(url: string): boolean {
  return url.includes("localhost") || url.includes("127.0.0.1") || url.includes("::1");
}

interface TestResult { ok: boolean; latencyMs: number; model: string; error?: string; hint?: string; }

export default function SettingsPage() {
  const [provider, setProvider] = useState<Provider>("ollama");
  const [model, setModel] = useState("llama3");
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");
  const [embedProvider, setEmbedProvider] = useState<Provider | "pinecone">("pinecone");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [keyStored, setKeyStored] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSettings()
      .then((s) => {
        setProvider(s.provider as Provider);
        setModel(s.model);
        setOllamaUrl(s.ollamaUrl ?? "http://localhost:11434");
        setEmbedProvider((s.embedProvider as Provider | "pinecone") ?? "pinecone");
        setKeyStored(s.keyStored ?? false);
      })
      .catch(() => toast.error("Failed to load settings"))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await patchSettings({
        providerConfig: { provider, model, ollamaUrl, embedProvider },
      });
      toast.success("Settings saved!");
      setTestResult(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally { setSaving(false); }
  };

  const handleSaveKey = async () => {
    if (!apiKey.trim()) return;
    setSavingKey(true);
    try {
      await saveApiKey(provider, apiKey.trim());
      setKeyStored(true);
      setApiKey("");
      toast.success(`${provider} API key saved securely`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save key");
    } finally { setSavingKey(false); }
  };

  const handleDeleteKey = async () => {
    try {
      await deleteApiKey(provider);
      setKeyStored(false);
      toast.success("API key removed");
    } catch { toast.error("Failed to remove key"); }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      if (provider === "ollama") {
        // Test local Ollama directly from browser
        const start = Date.now();
        const ok = await pingOllama(ollamaUrl);
        if (!ok) {
          setTestResult({ ok: false, latencyMs: 0, model, error: "Ollama is not reachable. Check that it is running and OLLAMA_ORIGINS is configured." });
          toast.error("Connection failed");
        } else {
          try {
            await ollamaComplete("Reply with exactly: OK", "You are a test assistant. Reply only with what is requested.", model, ollamaUrl);
            const latencyMs = Date.now() - start;
            setTestResult({ ok: true, latencyMs, model });
            toast.success(`Connected to ${model} in ${latencyMs}ms`);
          } catch (e) {
            setTestResult({ ok: false, latencyMs: 0, model, error: e instanceof Error ? e.message : "LLM check failed" });
            toast.error("Connection failed");
          }
        }
      } else {
        const r = await testProvider();
        setTestResult(r);
        if (r.ok) {
          toast.success(`Connected to ${r.model} in ${r.latencyMs}ms`);
        } else {
          toast.error(r.error ?? "Connection failed");
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test failed");
    } finally { setTesting(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-surface-base">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  const selectedProvider = PROVIDERS.find((p) => p.value === provider)!;
  const needsKey = provider !== "ollama";
  const isOllamaSelected = provider === "ollama";

  return (
    <div className="p-8 max-w-2xl mx-auto bg-surface-base text-text-primary font-body-default min-h-screen">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded bg-surface-raised border border-border-default flex items-center justify-center">
          <Settings size={20} className="text-primary" />
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-tight uppercase">Settings</h1>
          <p className="text-xs text-text-muted font-label-mono">Configure your AI provider and model</p>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

        {/* ── Ollama local dev / CORS guide ───────────────── */}
        {isOllamaSelected && (
          <motion.div
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border border-primary/30 bg-primary/8 overflow-hidden"
          >
            <div className="flex gap-3 p-4">
              <Server size={16} className="text-primary mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-primary mb-1">Connecting to Local Ollama in Production</p>
                <p className="text-[11px] text-text-muted leading-relaxed mb-3">
                  This app connects to Ollama directly from your browser. To allow this site to connect to your local Ollama instance, you must start Ollama with CORS enabled.
                </p>
                {/* Step-by-step */}
                <div className="space-y-2 text-[11px] text-text-primary/90">
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-primary shrink-0 w-4">1.</span>
                    <span>Close Ollama if it is already running.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-primary shrink-0 w-4">2.</span>
                    <span>Open a terminal or command prompt.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-primary shrink-0 w-4">3.</span>
                    <span>
                      Set the CORS origin environment variable and start Ollama:<br/>
                      <code className="bg-surface-raised px-1.5 py-0.5 rounded text-text-primary font-mono mt-1 inline-block border border-border-default">
                        OLLAMA_ORIGINS="*" ollama serve
                      </code>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Provider selector */}
        <div className="bg-surface-raised border border-border-subtle rounded-lg p-6">
          <label className="text-[10px] font-label-caps text-text-muted flex items-center gap-2 mb-4">
            <Server size={14} className="text-primary" /> LLM Provider
          </label>
          <div className="grid grid-cols-3 gap-3">
            {PROVIDERS.map((p) => (
              <button
                key={p.value}
                id={`provider-${p.value}-btn`}
                onClick={() => { setProvider(p.value); setModel(p.models[0]!); setTestResult(null); }}
                className={`p-3 rounded text-center transition-all border ${
                  provider === p.value
                    ? p.localOnly
                      ? "border-amber-500/60 bg-amber-500/10 text-amber-300"
                      : "border-primary bg-primary/10 text-primary"
                    : "border-border-default bg-surface-sunken text-text-muted hover:border-primary/50 hover:text-text-primary"
                }`}
              >
                <div className="font-semibold text-xs tracking-tight">{p.label}</div>
                <div className={`text-[9px] font-label-mono mt-0.5 ${
                  provider === p.value
                    ? p.localOnly ? "text-amber-400" : "text-primary/70"
                    : p.badgeColor || "text-text-muted"
                }`}>{p.badge}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Model */}
        <div className="bg-surface-raised border border-border-subtle rounded-lg p-6">
          <label className="text-[10px] font-label-caps text-text-muted flex items-center gap-2 mb-3">
            <Zap size={14} className="text-primary" /> Model
          </label>
          <select
            id="model-select"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="input-field mb-2"
          >
            {selectedProvider.models.map((m) => (
              <option key={m} value={m} className="bg-surface-raised text-text-primary">{m}</option>
            ))}
          </select>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="Or type a custom model name…"
            className="input-field"
          />
        </div>

        {/* Ollama URL */}
        {provider === "ollama" && (
          <div className="bg-surface-raised border border-border-subtle rounded-lg p-6">
            <label className="text-[10px] font-label-caps text-text-muted mb-1 block">Ollama Server URL</label>
            <p className="text-[10px] text-text-muted mb-3">
              Default is <code className="bg-surface-sunken px-1 rounded">http://localhost:11434</code>. 
            </p>
            <input
              id="ollama-url-input"
              type="text"
              value={ollamaUrl}
              onChange={(e) => setOllamaUrl(e.target.value)}
              placeholder="https://abc123.ngrok-free.app"
              className="input-field"
            />
          </div>
        )}

        {/* API Key */}
        {needsKey && (
          <div className="bg-surface-raised border border-border-subtle rounded-lg p-6">
            <label className="text-[10px] font-label-caps text-text-muted flex items-center gap-2 mb-4">
              <Key size={14} className="text-primary" /> API Key
            </label>
            {keyStored ? (
              <div className="flex items-center gap-3 p-3 rounded bg-primary/10 border border-primary/20">
                <CheckCircle2 size={16} className="text-primary shrink-0" />
                <span className="text-xs text-primary flex-1">API key saved securely (AES-256 encrypted)</span>
                <button
                  id="delete-key-btn"
                  onClick={handleDeleteKey}
                  className="text-text-muted hover:text-error transition-colors p-1"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <input
                    id="api-key-input"
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={`${selectedProvider.label} API key…`}
                    className="input-field pr-10"
                  />
                  <button
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                  >
                    {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <button
                  id="save-key-btn"
                  onClick={handleSaveKey}
                  disabled={!apiKey.trim() || savingKey}
                  className="btn-primary text-xs py-2 px-4 disabled:opacity-40 flex items-center gap-2"
                >
                  {savingKey ? <Loader2 size={12} className="animate-spin" /> : <Key size={12} />}
                  Save API Key
                </button>
                <p className="text-[9px] font-label-mono text-text-muted">Key is encrypted with AES-256-GCM and stored in MongoDB. Never in plain text.</p>
              </div>
            )}
          </div>
        )}

        {/* Embedding Provider */}
        <div className="bg-surface-raised border border-border-subtle rounded-lg p-6">
          <label className="text-[10px] font-label-caps text-text-muted mb-3 block">Embedding Provider</label>
          <select
            id="embed-provider-select"
            value={embedProvider}
            onChange={(e) => setEmbedProvider(e.target.value as Provider | "pinecone")}
            className="input-field mb-3"
          >
            <option value="pinecone">Pinecone (llama-text-embed-v2) — Recommended ✓</option>
            <option value="openai">OpenAI (text-embedding-3-small)</option>
            <option value="ollama">Ollama (nomic-embed-text) — local only</option>
          </select>
          <div className="flex items-start gap-3 p-3 rounded bg-primary/5 border border-primary/15">
            <div className="mt-0.5 w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <span className="text-[9px] text-primary font-bold">i</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-text-primary mb-0.5">Pinecone Embeddings (Recommended)</p>
              <p className="text-[10px] font-label-mono text-text-muted">
                Uses Pinecone's hosted <code>llama-text-embed-v2</code> model. Works in production with no extra API keys.
                {embedProvider === "ollama" && (
                  <span className="block mt-1 text-amber-400">⚠ Ollama embeddings won't work in production — switch to Pinecone.</span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button id="save-settings-btn" onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 disabled:opacity-50 text-xs">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Settings size={14} />}
            Save Settings
          </button>
          <button
            id="test-provider-btn"
            onClick={handleTest}
            disabled={testing}
            title="Test provider connectivity"
            className="btn-secondary flex items-center gap-2 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {testing ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
            Test Connection
          </button>
        </div>

        {/* Test result */}
        {testResult && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className={`flex items-center gap-3 p-4 rounded border text-xs font-label-mono ${
              testResult.ok
                ? "bg-primary/10 border-primary/20 text-primary"
                : testResult.hint === "local_only"
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                  : "bg-error/10 border-error/20 text-error"
            }`}
          >
            {testResult.ok
              ? <CheckCircle2 size={16} />
              : testResult.hint === "local_only"
                ? <AlertTriangle size={16} />
                : <XCircle size={16} />
            }
            {testResult.ok
              ? `Connected to ${testResult.model} in ${testResult.latencyMs}ms`
              : testResult.error ?? "Connection failed"
            }
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
