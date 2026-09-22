"use client";
import { useStudioStore, type ActiveView } from "@/store/useStudioStore";
import {
  LayoutDashboard,
  Film,
  Settings,
  Layers,
  Zap,
  ChevronRight,
  Plus,
} from "lucide-react";
import clsx from "clsx";

export default function Sidebar() {
  const { activeView, setActiveView, batches, activeBatchId, setActiveBatchId } = useStudioStore();

  const navItems: { id: ActiveView; icon: typeof LayoutDashboard; label: string }[] = [
    { id: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { id: "library", icon: Film, label: "Videos" },
    { id: "backgrounds", icon: Layers, label: "Backgrounds" },
    { id: "settings", icon: Settings, label: "Settings" },
  ];

  return (
    <aside className="sidebar flex flex-col w-[280px] min-h-screen bg-gray-950 border-r border-white/5 overflow-hidden">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/5 hidden md:block">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
            <Zap size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-tight">ChatStory</h1>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">Studio</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex md:flex-col flex-row flex-1 gap-1 p-3">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              setActiveView(item.id);
              setActiveBatchId(null);
            }}
            className={clsx(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all w-full text-left",
              (activeView === item.id || (item.id === "library" && activeView === "batch"))
                ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            )}
          >
            <item.icon size={18} />
            <span className="hidden md:block">{item.label}</span>
          </button>
        ))}

        {/* Recent batches */}
        <div className="hidden md:block mt-4 flex-1 overflow-auto">
          <div className="flex items-center justify-between px-3 mb-2">
            <span className="text-[11px] uppercase tracking-widest text-gray-600">Recent Batches</span>
            <button
              onClick={() => setActiveView("dashboard")}
              className="text-gray-600 hover:text-blue-400 transition-colors"
            >
              <Plus size={14} />
            </button>
          </div>
          <div className="space-y-1">
            {batches.slice(0, 8).map((batch) => {
              const done = batch.videos.filter((v) => v.status === "complete").length;
              const total = batch.videos.length;
              return (
                <button
                  key={batch.batchId}
                  onClick={() => {
                    setActiveBatchId(batch.batchId);
                    setActiveView("batch");
                  }}
                  className={clsx(
                    "w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all",
                    activeBatchId === batch.batchId
                      ? "bg-white/8 text-white"
                      : "text-gray-500 hover:text-gray-300 hover:bg-white/4"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Layers size={12} className="shrink-0" />
                    <span className="truncate">{batch.name}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <span className={clsx("text-[10px]", done === total ? "text-green-400" : "text-gray-600")}>
                      {done}/{total}
                    </span>
                    <ChevronRight size={10} className="text-gray-700" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </aside>
  );
}
