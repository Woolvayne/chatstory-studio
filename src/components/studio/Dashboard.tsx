"use client";
import { useState, useRef, useCallback } from "react";
import { useStudioStore } from "@/store/useStudioStore";
import {
  Upload, FileText, Zap, ChevronRight, X, AlertTriangle, Plus, Minus,
  Sparkles, Film, Mic, Image as ImageIcon,
} from "lucide-react";
import clsx from "clsx";
import { MISTRAL_MODELS, IMAGE_MODELS, VOICE_OPTIONS, VARIANT_LABELS, VARIANT_COLORS } from "@/types";
import type { VideoVariant } from "@/types";

export default function Dashboard() {
  const {
    settings,
    updateSettings,
    backgroundClips,
    createBatch,
    setActiveView,
    setActiveBatchId,
    envStatus,
    batches,
  } = useStudioStore();

  const [titlesText, setTitlesText] = useState("");
  const [batchName, setBatchName] = useState("");
  const [selectedMistralModel, setSelectedMistralModel] = useState(settings.defaultMistralModel);
  const [selectedImageModel, setSelectedImageModel] = useState(settings.defaultImageModel);
  const [selectedVoice, setSelectedVoice] = useState(settings.defaultVoice);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parsedTitles = titlesText
    .split(/\n|(?:,\s*)/)
    .map((t) => t.trim())
    .filter(Boolean);

  const handleFileUpload = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setTitlesText((prev) => (prev ? prev + "\n" + text : text));
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && (file.name.endsWith(".txt") || file.name.endsWith(".csv"))) {
        handleFileUpload(file);
      }
    },
    [handleFileUpload]
  );

  const handleGenerate = () => {
    if (parsedTitles.length === 0) {
      setError("Please enter at least one title idea.");
      return;
    }
    if (!settings.mistralApiKey?.trim() && !envStatus.mistral) {
      setError("Mistral API Key not configured. Please add it in Settings first.");
      return;
    }
    setError("");

    const nextCounter = useStudioStore.getState().batchCounter + 1;
    const counterStr = String(nextCounter).padStart(3, "0");
    const name = batchName.trim() || `Batch #${counterStr}`;
    const batchId = createBatch(name, parsedTitles.slice(0, 5));
    // Update settings with current selections
    updateSettings({
      defaultMistralModel: selectedMistralModel,
      defaultImageModel: selectedImageModel,
      defaultVoice: selectedVoice,
    });
    setActiveBatchId(batchId);
    setActiveView("batch");
  };

  const activeClips = backgroundClips.filter((c) => c.active);
  const hasMistralKey = Boolean(settings.mistralApiKey?.trim() || envStatus.mistral);
  const videoCount = Math.min(parsedTitles.length || 5, 5);

  const VARIANTS: VideoVariant[] = ["emotional", "dramatic", "mysterious", "twist", "escalation"];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="relative overflow-hidden border-b border-white/5 bg-gradient-to-b from-blue-950/30 to-transparent">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(59,130,246,0.15),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(168,85,247,0.15),transparent_60%)]" />
        <div className="relative px-8 pt-10 pb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium">
              <Sparkles size={11} />
              AI-Powered Batch Generation
            </div>
            <div className="text-xs text-gray-600">
              {batches.length} batch{batches.length !== 1 ? "es" : ""} created
            </div>
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight leading-none mb-3">
            Create <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">5 Viral Videos</span>
            <br />at Once
          </h1>
          <p className="text-gray-400 text-base max-w-xl">
            Enter title ideas → Mistral writes scripts → Puter generates AI images & voices → 5 unique short videos, ready to post
          </p>

          {/* Flow diagram */}
          <div className="flex items-center gap-2 mt-6 overflow-x-auto pb-2">
            {[
              { icon: FileText, label: "Titles", color: "text-blue-400" },
              { icon: Sparkles, label: "Mistral", color: "text-purple-400" },
              { icon: ImageIcon, label: "AI Images", color: "text-pink-400" },
              { icon: Mic, label: "TTS Voice", color: "text-cyan-400" },
              { icon: Film, label: "5 Videos", color: "text-green-400" },
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-2 shrink-0">
                <div className={clsx("flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/4 border border-white/8 text-xs font-medium", step.color)}>
                  <step.icon size={12} />
                  {step.label}
                </div>
                {i < 4 && <ChevronRight size={12} className="text-gray-700 shrink-0" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6 max-w-4xl mx-auto space-y-5">
        {/* API key warning */}
        {!hasMistralKey && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-amber-500/8 border border-amber-500/20">
            <div className="flex items-center gap-2 text-amber-400 text-sm">
              <AlertTriangle size={14} />
              <span>Mistral API Key not configured — add it in <strong>Settings</strong>. It is saved locally in this browser.</span>
            </div>
            <button
              onClick={() => setActiveView("settings")}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 text-xs hover:bg-amber-500/30 transition-all"
            >
              Open Settings
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left column: Title input */}
          <div className="lg:col-span-2 space-y-5">
            {/* Batch Name */}
            <div className="glass-card p-5">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Batch Name
              </label>
              <input
                type="text"
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                placeholder={`Batch #${String((useStudioStore.getState().batchCounter + 1)).padStart(3, "0")}`}
                className="w-full bg-white/5 border border-white/8 rounded-xl px-4 py-3 text-white placeholder-gray-700 text-sm focus:outline-none focus:border-blue-500/50 focus:bg-white/8 transition-all"
              />
            </div>

            {/* Title Ideas */}
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Title Ideas</label>
                  {parsedTitles.length > 0 && (
                    <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20">
                      {parsedTitles.length} detected
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/8 text-gray-400 hover:text-white hover:bg-white/10 transition-all text-xs"
                  >
                    <Upload size={11} />
                    TXT/CSV
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file);
                      e.target.value = "";
                    }}
                  />
                </div>
              </div>

              <div
                className={clsx(
                  "relative border-2 border-dashed rounded-xl transition-all",
                  isDragging ? "border-blue-500/60 bg-blue-500/5" : "border-white/8 hover:border-white/15"
                )}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
              >
                <textarea
                  value={titlesText}
                  onChange={(e) => setTitlesText(e.target.value)}
                  placeholder={"Enter one title per line, e.g.:\n\nMein Vermieter wollte mich aus meiner Wohnung werfen\nMein bester Freund hat mich angelogen\nIch fand etwas in meinem Auto\nMein Lehrer wusste ein Geheimnis über mich\nMein Nachbar beobachtete mich jeden Abend"}
                  rows={9}
                  className="w-full bg-transparent px-4 py-3 text-white placeholder-gray-700 text-sm focus:outline-none resize-none font-mono leading-relaxed"
                />
                {isDragging && (
                  <div className="absolute inset-0 flex items-center justify-center bg-blue-500/10 rounded-xl backdrop-blur-sm">
                    <div className="text-center">
                      <FileText size={32} className="text-blue-400 mx-auto mb-2" />
                      <p className="text-blue-400 font-medium">Drop TXT or CSV file</p>
                    </div>
                  </div>
                )}
              </div>

              {parsedTitles.length > 5 && (
                <p className="mt-2 text-xs text-amber-400/80 flex items-center gap-1">
                  <AlertTriangle size={10} />
                  First 5 will be used. {parsedTitles.length - 5} remaining for next batch.
                </p>
              )}
            </div>

            {/* Variants Preview */}
            {parsedTitles.length > 0 && (
              <div className="glass-card p-5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Video Variants</p>
                <div className="space-y-2">
                  {parsedTitles.slice(0, 5).map((title, i) => {
                    const variant = VARIANTS[i];
                    const color = VARIANT_COLORS[variant];
                    return (
                      <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/3 border border-white/5">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold border shrink-0"
                          style={{ color, borderColor: `${color}40`, backgroundColor: `${color}15` }}
                        >
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white truncate">{title}</p>
                          <p className="text-[10px] text-gray-600">{VARIANT_LABELS[variant]}</p>
                        </div>
                        <span className="text-lg shrink-0">
                          {["❤️", "🎭", "🔮", "🌀", "⚡"][i]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right column: Options */}
          <div className="space-y-4">
            {/* AI Options */}
            <div className="glass-card p-5 space-y-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">AI Configuration</p>

              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Mistral Model</label>
                <select
                  value={selectedMistralModel}
                  onChange={(e) => setSelectedMistralModel(e.target.value)}
                  className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 appearance-none"
                >
                  {MISTRAL_MODELS.map((m) => (
                    <option key={m.value} value={m.value} className="bg-gray-900">{m.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Image Model (Puter)</label>
                <select
                  value={selectedImageModel}
                  onChange={(e) => setSelectedImageModel(e.target.value)}
                  className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 appearance-none"
                >
                  {IMAGE_MODELS.map((m) => (
                    <option key={m.value} value={m.value} className="bg-gray-900">{m.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Default Voice (Puter TTS)</label>
                <select
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value)}
                  className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 appearance-none"
                >
                  {VOICE_OPTIONS.map((v) => (
                    <option key={v.value} value={v.value} className="bg-gray-900">{v.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Background clips */}
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Background</p>
                <button
                  onClick={() => setActiveView("backgrounds")}
                  className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                >
                  Manage <ChevronRight size={10} />
                </button>
              </div>

              {activeClips.length === 0 ? (
                <div
                  onClick={() => setActiveView("backgrounds")}
                  className="border border-dashed border-white/10 rounded-xl p-4 text-center cursor-pointer hover:border-white/20 transition-all"
                >
                  <Film size={20} className="text-gray-700 mx-auto mb-2" />
                  <p className="text-xs text-gray-600">No clips selected</p>
                  <p className="text-[10px] text-gray-700 mt-1">Click to upload gameplay videos</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {activeClips.slice(0, 4).map((clip) => (
                    <div key={clip.id} className="flex items-center gap-2 text-xs">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                      <span className="text-gray-400 truncate">{clip.name}</span>
                    </div>
                  ))}
                  {activeClips.length > 4 && (
                    <p className="text-[10px] text-gray-600">+{activeClips.length - 4} more</p>
                  )}
                </div>
              )}
            </div>

            {/* Generate Button */}
            <div className="space-y-3">
              {error && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                  <X size={12} />
                  {error}
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={parsedTitles.length === 0}
                className={clsx(
                  "w-full py-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2.5",
                  parsedTitles.length > 0
                    ? "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98]"
                    : "bg-white/5 text-gray-600 cursor-not-allowed"
                )}
              >
                <Zap size={18} />
                Generate {videoCount} Video{videoCount !== 1 ? "s" : ""}
              </button>

              <p className="text-center text-[10px] text-gray-700">
                Up to 5 unique variants • Parallel processing • ZIP download
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
