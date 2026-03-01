"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsContent />
    </Suspense>
  );
}

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [authStatus, setAuthStatus] = useState<{
    connected: boolean;
    accounts: Array<{ email: string; addedAt: string }>;
  }>({ connected: false, accounts: [] });
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (searchParams.get("connected") === "true") {
      const email = searchParams.get("email");
      toast.success(
        email ? `Connected ${email}` : "Gmail connected successfully!"
      );
    }
    if (searchParams.get("error")) {
      toast.error(`Connection failed: ${searchParams.get("error")}`);
    }
  }, [searchParams]);

  useEffect(() => {
    fetch("/api/auth/status")
      .then((r) => r.json())
      .then(setAuthStatus)
      .catch(console.error);

    fetch("/api/settings")
      .then((r) => r.json())
      .then(setSettings)
      .catch(console.error);
  }, []);

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
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      {/* Gmail Accounts */}
      <Card>
        <CardHeader>
          <CardTitle>Gmail Accounts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
                <span>No accounts connected</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Connect your Gmail account to automatically scan for shipping
                emails.
              </p>
            </div>
          )}
          <Button
            variant={authStatus.accounts.length > 0 ? "outline" : "default"}
            onClick={() => (window.location.href = "/api/auth/login")}
          >
            {authStatus.accounts.length > 0
              ? "Add Another Account"
              : "Connect Gmail"}
          </Button>
        </CardContent>
      </Card>

      {/* Sync */}
      <Card>
        <CardHeader>
          <CardTitle>Email Sync</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Emails are automatically synced every 30 minutes when Gmail is
            connected. You can also trigger a manual sync.
          </p>
          <Button
            onClick={handleSync}
            disabled={!authStatus.connected || isSyncing}
          >
            {isSyncing ? "Syncing..." : "Sync Now"}
          </Button>
        </CardContent>
      </Card>

      {/* Overdue Thresholds */}
      <Card>
        <CardHeader>
          <CardTitle>Overdue Thresholds</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Number of days after which a shipment is marked as overdue.
          </p>
          <form
            className="space-y-3"
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
                <label className="text-sm font-medium">
                  Israel Domestic (days)
                </label>
                <Input
                  name="overdue_israel_domestic_days"
                  type="number"
                  defaultValue={settings.overdue_israel_domestic_days || "5"}
                />
              </div>
              <div>
                <label className="text-sm font-medium">
                  Domestic US (days)
                </label>
                <Input
                  name="overdue_domestic_days"
                  type="number"
                  defaultValue={settings.overdue_domestic_days || "7"}
                />
              </div>
              <div>
                <label className="text-sm font-medium">
                  International (days)
                </label>
                <Input
                  name="overdue_international_days"
                  type="number"
                  defaultValue={settings.overdue_international_days || "30"}
                />
              </div>
              <div>
                <label className="text-sm font-medium">
                  China / AliExpress (days)
                </label>
                <Input
                  name="overdue_china_days"
                  type="number"
                  defaultValue={settings.overdue_china_days || "45"}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">
                Stuck detection: no update for (days)
              </label>
              <Input
                name="overdue_stuck_days"
                type="number"
                defaultValue={settings.overdue_stuck_days || "7"}
                className="max-w-32"
              />
            </div>
            <Button type="submit">Save Thresholds</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
