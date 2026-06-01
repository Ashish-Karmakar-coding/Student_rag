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
  Eye, EyeOff, Trash2, Zap, Key, Server,
} from "lucide-react";
import { getSettings, patchSettings, saveApiKey, deleteApiKey, testProvider } from "../../../lib/api";

type Provider = "ollama" | "openai" | "anthropic";

const PROVIDERS: { value: Provider; label: string; badge: string; models: string[] }[] = [
  {
    value: "ollama",
    label: "Ollama",
    badge: "Local",
    models: ["llama3", "llama3.1", "mistral", "phi3", "gemma2", "qwen2.5"],
  },
  {
    value: "openai",
    label: "OpenAI",
    badge: "Cloud",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"],
  },
  {
    value: "anthropic",
    label: "Anthropic",
    badge: "Cloud",
    models: ["claude-3-5-sonnet-20241022", "claude-3-haiku-20240307", "claude-3-opus-20240229"],
  },
];

const EMBED_MODELS = {
  ollama: ["nomic-embed-text", "mxbai-embed-large", "all-minilm"],
  openai: ["text-embedding-3-small", "text-embedding-3-large", "text-embedding-ada-002"],
  anthropic: ["nomic-embed-text (via Ollama)"],
};

interface TestResult { ok: boolean; latencyMs: number; model: string; error?: string; }

export default function SettingsPage() {
  const [provider, setProvider] = useState<Provider>("ollama");
  const [model, setModel] = useState("llama3");
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");
  const [embedProvider, setEmbedProvider] = useState<"ollama" | "openai">("ollama");
  const [embedModel, setEmbedModel] = useState("nomic-embed-text");
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
        setEmbedProvider((s.embedProvider ?? "ollama") as "ollama" | "openai");
        setEmbedModel(s.embedModel ?? "nomic-embed-text");
        setKeyStored(s.keyStored);
      })
      .catch(() => toast.error("Failed to load settings"))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await patchSettings({
        providerConfig: { provider, model, ollamaUrl, embedProvider, embedModel },
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
      toast.success(`${provider} API key saved to keychain`);
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
      const r = await testProvider();
      setTestResult(r);
      if (r.ok) toast.success(`Connected! ${r.latencyMs}ms`);
      else toast.error(r.error ?? "Connection failed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test failed");
    } finally { setTesting(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={28} className="animate-spin text-violet-400" />
      </div>
    );
  }

  const selectedProvider = PROVIDERS.find((p) => p.value === provider)!;
  const needsKey = provider !== "ollama";

  return (
    <div className="p-8 max-w-2xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600/30 to-indigo-700/20 border border-violet-500/25 flex items-center justify-center">
          <Settings size={20} className="text-violet-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Settings</h1>
          <p className="text-sm text-white/40">Configure your AI provider and model</p>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">

        {/* Provider selector */}
        <div className="glass rounded-2xl p-6">
          <label className="text-sm font-semibold text-white/70 flex items-center gap-2 mb-4"><Server size={15} /> LLM Provider</label>
          <div className="grid grid-cols-3 gap-3">
            {PROVIDERS.map((p) => (
              <button
                key={p.value}
                id={`provider-${p.value}-btn`}
                onClick={() => { setProvider(p.value); setModel(p.models[0]!); setTestResult(null); }}
                className={`p-3 rounded-xl border text-center transition-all ${
                  provider === p.value
                    ? "border-violet-500/50 bg-violet-500/15 text-white"
                    : "border-white/8 bg-white/[0.02] text-white/50 hover:border-white/15 hover:text-white/80"
                }`}
              >
                <div className="font-semibold text-sm">{p.label}</div>
                <div className={`text-[10px] mt-0.5 ${provider === p.value ? "text-violet-300" : "text-white/30"}`}>{p.badge}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Model */}
        <div className="glass rounded-2xl p-6">
          <label className="text-sm font-semibold text-white/70 flex items-center gap-2 mb-3"><Zap size={15} /> Model</label>
          <select
            id="model-select"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="input-field"
          >
            {selectedProvider.models.map((m) => (
              <option key={m} value={m} className="bg-[#161627]">{m}</option>
            ))}
          </select>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="Or type a custom model name…"
            className="input-field mt-2 text-sm"
          />
        </div>

        {/* Ollama URL */}
        {provider === "ollama" && (
          <div className="glass rounded-2xl p-6">
            <label className="text-sm font-semibold text-white/70 mb-3 block">Ollama Server URL</label>
            <input
              id="ollama-url-input"
              type="text"
              value={ollamaUrl}
              onChange={(e) => setOllamaUrl(e.target.value)}
              className="input-field"
            />
          </div>
        )}

        {/* API Key */}
        {needsKey && (
          <div className="glass rounded-2xl p-6">
            <label className="text-sm font-semibold text-white/70 flex items-center gap-2 mb-4"><Key size={15} /> API Key</label>
            {keyStored ? (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                <CheckCircle2 size={16} className="text-green-400" />
                <span className="text-sm text-green-300 flex-1">Key stored in OS keychain</span>
                <button
                  id="delete-key-btn"
                  onClick={handleDeleteKey}
                  className="text-red-400/60 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={15} />
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                  >
                    {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <button
                  id="save-key-btn"
                  onClick={handleSaveKey}
                  disabled={!apiKey.trim() || savingKey}
                  className="btn-primary text-sm py-2 px-4 disabled:opacity-40 flex items-center gap-2"
                >
                  {savingKey ? <Loader2 size={13} className="animate-spin" /> : <Key size={13} />}
                  Save to keychain
                </button>
                <p className="text-xs text-white/25">Key is stored in your OS keychain — never in the database</p>
              </div>
            )}
          </div>
        )}

        {/* Embedding */}
        <div className="glass rounded-2xl p-6">
          <label className="text-sm font-semibold text-white/70 mb-3 block">Embedding Provider</label>
          <div className="grid grid-cols-2 gap-3 mb-3">
            {(["ollama", "openai"] as const).map((ep) => (
              <button
                key={ep}
                onClick={() => { setEmbedProvider(ep); setEmbedModel(EMBED_MODELS[ep][0]!.split(" ")[0]!); }}
                className={`p-2.5 rounded-xl border text-sm transition-all ${
                  embedProvider === ep
                    ? "border-violet-500/40 bg-violet-500/12 text-white"
                    : "border-white/8 text-white/40 hover:text-white/70 hover:border-white/15"
                }`}
              >
                {ep === "ollama" ? "Ollama (Local)" : "OpenAI (Cloud)"}
              </button>
            ))}
          </div>
          <select
            value={embedModel}
            onChange={(e) => setEmbedModel(e.target.value)}
            className="input-field text-sm"
          >
            {EMBED_MODELS[embedProvider].map((m) => (
              <option key={m} value={m.split(" ")[0]} className="bg-[#161627]">{m}</option>
            ))}
          </select>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button id="save-settings-btn" onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 disabled:opacity-50">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Settings size={15} />}
            Save Settings
          </button>
          <button id="test-provider-btn" onClick={handleTest} disabled={testing} className="btn-ghost flex items-center gap-2">
            {testing ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
            Test Connection
          </button>
        </div>

        {/* Test result */}
        {testResult && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className={`flex items-center gap-3 p-4 rounded-xl border text-sm ${
              testResult.ok
                ? "bg-green-500/10 border-green-500/20 text-green-300"
                : "bg-red-500/10 border-red-500/20 text-red-300"
            }`}
          >
            {testResult.ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
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
