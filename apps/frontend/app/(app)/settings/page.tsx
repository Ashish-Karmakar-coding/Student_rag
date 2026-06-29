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


interface TestResult { ok: boolean; latencyMs: number; model: string; error?: string; }

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
        setKeyStored(s.keyStored);
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
      <div className="flex items-center justify-center h-full bg-surface-base">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  const selectedProvider = PROVIDERS.find((p) => p.value === provider)!;
  const needsKey = provider !== "ollama";

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
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border-default bg-surface-sunken text-text-muted hover:border-primary/50 hover:text-text-primary"
                }`}
              >
                <div className="font-semibold text-xs tracking-tight">{p.label}</div>
                <div className={`text-[9px] font-label-mono mt-0.5 ${provider === p.value ? "text-primary/70" : "text-text-muted"}`}>{p.badge}</div>
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
            <label className="text-[10px] font-label-caps text-text-muted mb-3 block">Ollama Server URL</label>
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
          <div className="bg-surface-raised border border-border-subtle rounded-lg p-6">
            <label className="text-[10px] font-label-caps text-text-muted flex items-center gap-2 mb-4">
              <Key size={14} className="text-primary" /> API Key
            </label>
            {keyStored ? (
              <div className="flex items-center gap-3 p-3 rounded bg-primary/10 border border-primary/20">
                <CheckCircle2 size={16} className="text-primary shrink-0" />
                <span className="text-xs text-primary flex-1">Key stored securely in OS keychain</span>
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
                  Save to keychain
                </button>
                <p className="text-[9px] font-label-mono text-text-muted">Key is stored in your OS keychain — never in the database.</p>
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
            <option value="pinecone">Pinecone (llama-text-embed-v2)</option>
            <option value="openai">OpenAI (text-embedding-3-small)</option>
            <option value="ollama">Ollama (nomic-embed-text)</option>
          </select>
          <div className="flex items-start gap-3 p-3 rounded bg-primary/5 border border-primary/15">
            <div className="mt-0.5 w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <span className="text-[9px] text-primary font-bold">i</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-text-primary mb-0.5">Embeddings Note</p>
              <p className="text-[10px] font-label-mono text-text-muted">
                If Pinecone returns a 404 error, select OpenAI here. Make sure you have saved your OpenAI API key above!
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
          <button id="test-provider-btn" onClick={handleTest} disabled={testing} className="btn-secondary flex items-center gap-2 text-xs">
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
                : "bg-error/10 border-error/20 text-error"
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
