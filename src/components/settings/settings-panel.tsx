"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const [authStatus, setAuthStatus] = useState<{
    connected: boolean;
    accounts: Array<{ email: string; addedAt: string }>;
  }>({ connected: false, accounts: [] });
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch("/api/auth/status")
      .then((r) => r.json())
      .then(setAuthStatus)
      .catch(console.error);

    fetch("/api/settings")
      .then((r) => r.json())
      .then(setSettings)
      .catch(console.error);
  }, [open]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && open) onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  async function handleSync() {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success(
          `Sync complete: ${data.shipmentsCreated} new, ${data.shipmentsUpdated} updated`
        );
      } else {
        toast.error(data.error || "Sync failed");
      }
    } catch {
      toast.error("Sync failed");
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleRemoveAccount(email: string) {
    try {
      const res = await fetch(
        `/api/auth/account?email=${encodeURIComponent(email)}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setAuthStatus((prev) => {
          const remaining = prev.accounts.filter((a) => a.email !== email);
          return { connected: remaining.length > 0, accounts: remaining };
        });
        toast.success(`Disconnected ${email}`);
      } else {
        toast.error("Failed to remove account");
      }
    } catch {
      toast.error("Failed to remove account");
    }
  }

  async function saveSettings(updates: Record<string, string>) {
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        setSettings((prev) => ({ ...prev, ...updates }));
        toast.success("Settings saved");
      }
    } catch {
      toast.error("Failed to save settings");
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/40 transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-background shadow-2xl transition-transform duration-300 ease-in-out flex flex-col",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4 shrink-0">
          <h2 className="text-lg font-semibold font-poppins">Settings</h2>
          <button
            onClick={onClose}
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
          {/* Gmail Accounts */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Gmail Accounts</h3>
            {authStatus.accounts.length > 0 ? (
              <div className="space-y-2">
                {authStatus.accounts.map((account) => (
                  <div
                    key={account.email}
                    className="flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-2.5 w-2.5 rounded-full bg-green-500 shrink-0" />
                      <span className="text-sm truncate">{account.email}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive shrink-0 ml-2"
                      onClick={() => handleRemoveAccount(account.email)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-gray-400" />
                  <span className="text-sm">No accounts connected</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Connect your Gmail account to automatically scan for shipping emails.
                </p>
              </div>
            )}
            <Button
              size="sm"
              variant={authStatus.accounts.length > 0 ? "outline" : "default"}
              onClick={() => (window.location.href = "/api/auth/login")}
            >
              {authStatus.accounts.length > 0
                ? "Add Another Account"
                : "Connect Gmail"}
            </Button>
          </section>

          <Separator />

          {/* Email Sync */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email Sync</h3>
            <p className="text-sm text-muted-foreground">
              Emails are automatically synced every 30 minutes. You can also trigger a manual sync.
            </p>
            <Button
              size="sm"
              onClick={handleSync}
              disabled={!authStatus.connected || isSyncing}
            >
              {isSyncing ? "Syncing..." : "Sync Now"}
            </Button>
          </section>

          <Separator />

          {/* Overdue Thresholds */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Overdue Thresholds</h3>
            <p className="text-sm text-muted-foreground">
              Days after which a shipment is marked as overdue.
            </p>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const updates: Record<string, string> = {};
                formData.forEach((value, key) => {
                  updates[key] = String(value);
                });
                saveSettings(updates);
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Israel Domestic (days)</label>
                  <Input
                    name="overdue_israel_domestic_days"
                    type="number"
                    defaultValue={settings.overdue_israel_domestic_days || "5"}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Domestic US (days)</label>
                  <Input
                    name="overdue_domestic_days"
                    type="number"
                    defaultValue={settings.overdue_domestic_days || "7"}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">International (days)</label>
                  <Input
                    name="overdue_international_days"
                    type="number"
                    defaultValue={settings.overdue_international_days || "30"}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">China / AliExpress (days)</label>
                  <Input
                    name="overdue_china_days"
                    type="number"
                    defaultValue={settings.overdue_china_days || "45"}
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Stuck detection: no update for (days)</label>
                <Input
                  name="overdue_stuck_days"
                  type="number"
                  defaultValue={settings.overdue_stuck_days || "7"}
                  className="mt-1 max-w-32"
                />
              </div>
              <Button type="submit" size="sm">Save Thresholds</Button>
            </form>
          </section>
        </div>
      </div>
    </>
  );
}
