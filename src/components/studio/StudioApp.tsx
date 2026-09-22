"use client";
import { useEffect } from "react";
import { useStudioStore } from "@/store/useStudioStore";
import { loadLocalBackgroundClips } from "@/lib/localClipStorage";
import Sidebar from "./Sidebar";
import Dashboard from "./Dashboard";
import BatchView from "./BatchView";
import BackgroundLibrary from "./BackgroundLibrary";
import SettingsView from "./SettingsView";
import LibraryView from "./LibraryView";

export default function StudioApp() {
  const { activeView, setEnvStatus, restoreBackgroundClips } = useStudioStore();

  useEffect(() => {
    // Environment variables are only used as an optional server-side fallback.
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.envStatus) setEnvStatus(data.envStatus);
      })
      .catch(console.error);
  }, [setEnvStatus]);

  useEffect(() => {
    let cancelled = false;

    // Video files are intentionally kept out of localStorage. IndexedDB can
    // store the original File/Blob and is supported by Safari as well.
    loadLocalBackgroundClips()
      .then((clips) => {
        if (!cancelled) restoreBackgroundClips(clips);
      })
      .catch((error) => {
        // Private browsing modes can disable IndexedDB. The app still works for
        // the current session, but the user should know why a clip did not load.
        console.warn("Local background clips could not be restored:", error);
      });

    return () => {
      cancelled = true;
    };
  }, [restoreBackgroundClips]);

  const renderView = () => {
    switch (activeView) {
      case "dashboard":
        return <Dashboard />;
      case "batch":
        return <BatchView />;
      case "library":
        return <LibraryView />;
      case "backgrounds":
        return <BackgroundLibrary />;
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
