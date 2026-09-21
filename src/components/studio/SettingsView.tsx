"use client";
import { useState, useEffect } from "react";
import { useStudioStore } from "@/store/useStudioStore";
import {
  Settings, Key, CheckCircle2, XCircle, Loader2, Save,
  Info, ExternalLink, Database, Image, Mic, Clock,
} from "lucide-react";
import clsx from "clsx";
import { MISTRAL_MODELS, IMAGE_MODELS, VOICE_OPTIONS } from "@/types";

export default function SettingsView() {
  const { settings, updateSettings, envStatus, setEnvStatus } = useStudioStore();
  const [checkingEnv, setCheckingEnv] = useState(false);
  const [saveStatus, setSaveStatus] = useState<Record<string, boolean>>({});

  useEffect(() => {
    checkEnvStatus();
  }, []);

  const checkEnvStatus = async () => {
    setCheckingEnv(true);
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setEnvStatus(data.envStatus);
      }
    } catch (err) {
      console.error("Failed to check env:", err);
    } finally {
      setCheckingEnv(false);
    }
  };

  const handleSaveSetting = async (key: string, value: string) => {
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      setSaveStatus((prev) => ({ ...prev, [key]: true }));
      setTimeout(() => setSaveStatus((prev) => ({ ...prev, [key]: false })), 2000);
    } catch (err) {
      console.error("Save failed:", err);
    }
  };

  const EnvBadge = ({ ok }: { ok: boolean }) => (
    <span className={clsx(
      "flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border",
      ok ? "text-green-400 bg-green-500/10 border-green-500/20" : "text-red-400 bg-red-500/10 border-red-500/20"
    )}>
      {ok ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
      {ok ? "Configured" : "Not configured"}
    </span>
  );

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Settings</h2>
          <p className="text-gray-500 text-sm mt-1">Configure API keys and default preferences</p>
        </div>
        <button
          onClick={checkEnvStatus}
          disabled={checkingEnv}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white text-xs transition-all"
        >
          {checkingEnv ? <Loader2 size={12} className="animate-spin" /> : null}
          Refresh Status
        </button>
      </div>

      {/* API Status */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-bold text-gray-300 mb-4 flex items-center gap-2">
          <Key size={14} />
          API Status
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-white/5">
            <div>
              <p className="text-sm text-white">Mistral AI</p>
              <p className="text-xs text-gray-600">MISTRAL_API_KEY environment variable</p>
            </div>
            <EnvBadge ok={envStatus.mistral} />
          </div>
          <div className="flex items-center justify-between py-2 border-b border-white/5">
            <div>
              <p className="text-sm text-white">Buffer</p>
              <p className="text-xs text-gray-600">BUFFER_API_KEY environment variable</p>
            </div>
            <EnvBadge ok={envStatus.buffer} />
          </div>
          <div className="flex items-center justify-between py-2 border-b border-white/5">
            <div>
              <p className="text-sm text-white">Vercel Blob</p>
              <p className="text-xs text-gray-600">BLOB_READ_WRITE_TOKEN environment variable</p>
            </div>
            <EnvBadge ok={envStatus.blob} />
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm text-white">Puter.js</p>
              <p className="text-xs text-gray-600">Image generation & TTS — no API key needed</p>
            </div>
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border text-blue-400 bg-blue-500/10 border-blue-500/20">
              <CheckCircle2 size={10} />
              Free / Unlimited
            </span>
          </div>
        </div>

        <div className="mt-4 p-3 rounded-xl bg-blue-500/5 border border-blue-500/10 text-xs text-gray-500">
          <p className="font-medium text-gray-400 mb-1">🔐 Security Note</p>
          <p>API keys are stored as environment variables on the server. They are never exposed to the browser. Set them in your Vercel project settings or .env file.</p>
        </div>
      </div>

      {/* Environment Variables Guide */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-bold text-gray-300 mb-4 flex items-center gap-2">
          <Database size={14} />
          Environment Variables
        </h3>
        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-black/30 font-mono text-xs text-gray-400 space-y-1">
            <p><span className="text-amber-400">MISTRAL_API_KEY</span>=<span className="text-gray-600">your-mistral-api-key</span></p>
            <p><span className="text-purple-400">BUFFER_API_KEY</span>=<span className="text-gray-600">your-buffer-access-token</span></p>
            <p><span className="text-blue-400">BLOB_READ_WRITE_TOKEN</span>=<span className="text-gray-600">vercel-blob-token</span></p>
            <p><span className="text-green-400">DATABASE_URL</span>=<span className="text-gray-600">postgresql://...</span></p>
          </div>
          <div className="flex gap-2 text-xs">
            <a href="https://console.mistral.ai/" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-all">
              Get Mistral Key <ExternalLink size={10} />
            </a>
            <a href="https://buffer.com/developers/apps" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-all">
              Get Buffer Key <ExternalLink size={10} />
            </a>
            <a href="https://vercel.com/docs/storage/vercel-blob" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-all">
              Vercel Blob <ExternalLink size={10} />
            </a>
          </div>
        </div>
      </div>

      {/* Default Preferences */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-bold text-gray-300 mb-4 flex items-center gap-2">
          <Settings size={14} />
          Default Preferences
        </h3>
        <div className="space-y-4">
          {/* Mistral Model */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5 flex items-center gap-1.5">
              <Database size={11} /> Default Mistral Model
            </label>
            <select
              value={settings.defaultMistralModel}
              onChange={(e) => updateSettings({ defaultMistralModel: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50"
            >
              {MISTRAL_MODELS.map((m) => (
                <option key={m.value} value={m.value} className="bg-gray-900">{m.label}</option>
              ))}
            </select>
          </div>

          {/* Image Model */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5 flex items-center gap-1.5">
              <Image size={11} /> Default Image Model (Puter.js)
            </label>
            <select
              value={settings.defaultImageModel}
              onChange={(e) => updateSettings({ defaultImageModel: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50"
            >
              {IMAGE_MODELS.map((m) => (
                <option key={m.value} value={m.value} className="bg-gray-900">{m.label}</option>
              ))}
            </select>
          </div>

          {/* Default Voice */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5 flex items-center gap-1.5">
              <Mic size={11} /> Default Voice
            </label>
            <select
              value={settings.defaultVoice}
              onChange={(e) => updateSettings({ defaultVoice: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50"
            >
              {VOICE_OPTIONS.map((v) => (
                <option key={v.value} value={v.value} className="bg-gray-900">{v.label}</option>
              ))}
            </select>
          </div>

          {/* Default Duration */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5 flex items-center gap-1.5">
              <Clock size={11} /> Default Video Duration (seconds)
            </label>
            <input
              type="number"
              min={30}
              max={60}
              value={settings.defaultDuration}
              onChange={(e) => updateSettings({ defaultDuration: parseInt(e.target.value) || 55 })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50"
            />
          </div>

          {/* Default Hashtags */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Default Hashtags</label>
            <input
              type="text"
              value={settings.defaultHashtags}
              onChange={(e) => updateSettings({ defaultHashtags: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50"
              placeholder="#chatstory #viral #shorts"
            />
          </div>
        </div>
      </div>

      {/* Puter.js Info */}
      <div className="glass-card p-5 border-blue-500/10">
        <h3 className="text-sm font-bold text-gray-300 mb-3 flex items-center gap-2">
          <Info size={14} className="text-blue-400" />
          Puter.js (Free AI Services)
        </h3>
        <div className="space-y-2 text-xs text-gray-500">
          <p>Puter.js provides <strong className="text-gray-300">free, unlimited</strong> AI image generation and text-to-speech without requiring any API keys.</p>
          <p>Available image models: <span className="text-gray-300">FLUX, DALL·E 3, Stable Diffusion</span></p>
          <p>TTS languages: <span className="text-gray-300">German, English, French, Spanish and more</span></p>
          <a
            href="https://developer.puter.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors mt-2"
          >
            Puter.js Documentation <ExternalLink size={10} />
          </a>
        </div>
      </div>
    </div>
  );
}
