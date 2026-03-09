"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { RefreshCw, Settings } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { SettingsPanel } from "@/components/settings/settings-panel";

export function Header() {
  const [showSettings, setShowSettings] = useState(false);
  const pathname = usePathname();

  if (pathname === "/login") return null;

  return (
    <>
      <header className="border-b bg-card">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <Link href="/" className="text-lg font-semibold font-poppins">
            LootBox
          </Link>
          <button
            onClick={() => setShowSettings(true)}
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </header>
      <SettingsPanel open={showSettings} onClose={() => setShowSettings(false)} />
    </>
  );
}

export function SyncButton() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const fetchSyncStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/sync");
      if (res.ok) {
        const data = await res.json();
        if (data?.completedAt) {
          setLastSync(data.completedAt);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchSyncStatus();
    const interval = setInterval(fetchSyncStatus, 60_000);
    return () => clearInterval(interval);
  }, [fetchSyncStatus]);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Sync failed");
      } else {
        toast.success(
          `Sync complete: ${data.emailsScanned || 0} emails scanned, ${data.shipmentsCreated || 0} new, ${data.shipmentsUpdated || 0} updated`
        );
        setLastSync(new Date().toISOString());
        window.dispatchEvent(new Event("shipments-updated"));
      }
    } catch {
      toast.error("Sync failed — check your connection");
    } finally {
      setIsSyncing(false);
    }
  };

  const label = isSyncing
    ? "Syncing..."
    : isHovered
      ? "Sync now"
      : lastSync
        ? `Synced ${formatDistanceToNow(new Date(lastSync), { addSuffix: true })}`
        : "Sync now";

  return (
    <button
      onClick={handleSync}
      disabled={isSyncing}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="inline-flex items-center gap-2 self-stretch rounded-lg px-3 text-xs text-muted-foreground transition-all hover:bg-muted hover:text-foreground disabled:opacity-60"
    >
      <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
      {label}
    </button>
  );
}
