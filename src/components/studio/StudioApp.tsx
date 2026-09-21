"use client";
import { useEffect } from "react";
import { useStudioStore } from "@/store/useStudioStore";
import Sidebar from "./Sidebar";
import Dashboard from "./Dashboard";
import BatchView from "./BatchView";
import BackgroundLibrary from "./BackgroundLibrary";
import SettingsView from "./SettingsView";
import LibraryView from "./LibraryView";

export default function StudioApp() {
  const { activeView, setEnvStatus } = useStudioStore();

  useEffect(() => {
    // Load env status on mount
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.envStatus) setEnvStatus(data.envStatus);
      })
      .catch(console.error);
  }, [setEnvStatus]);

  const renderView = () => {
    switch (activeView) {
      case "dashboard":
        return <Dashboard />;
      case "batch":
        return <BatchView />;
      case "library":
        return <LibraryView />;
      case "settings":
        return <SettingsView />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-950">
      <Sidebar />
      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        <div className="animate-fade-in">
          {renderView()}
        </div>
      </main>
    </div>
  );
}
