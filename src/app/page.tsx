"use client";

import { useState, useCallback, useEffect } from "react";
import { Filter, Gem, ClipboardList, Plus, Users } from "lucide-react";
import { SearchBar } from "@/components/dashboard/search-bar";
import { ShipmentList } from "@/components/dashboard/shipment-list";
import { LootTimeline } from "@/components/dashboard/loot-timeline";
import { ShipmentForm } from "@/components/shipment/shipment-form";
import { ShipmentPanel } from "@/components/shipment/shipment-panel";
import { SyncButton } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useShipments } from "@/hooks/use-shipments";
import { cn } from "@/lib/utils";
import type { ShipmentStatus } from "@/types/shipment";

const STATUS_GROUPS = [
  {
    key: "on_the_way",
    label: "On the Way",
    statuses: ["ordered", "shipped", "in_transit", "customs_held", "out_for_delivery", "ready_for_pickup"] as ShipmentStatus[],
    color: "bg-blue-100 text-blue-800 border-blue-200",
    activeColor: "bg-blue-500 text-white border-blue-500",
  },
  {
    key: "delivered",
    label: "Delivered",
    statuses: ["delivered", "picked_up"] as ShipmentStatus[],
    color: "bg-green-100 text-green-800 border-green-200",
    activeColor: "bg-green-500 text-white border-green-500",
  },
  {
    key: "attention",
    label: "Attention",
    statuses: ["overdue", "stuck", "lost"] as ShipmentStatus[],
    color: "bg-red-100 text-red-800 border-red-200",
    activeColor: "bg-red-500 text-white border-red-500",
  },
] as const;

const MORE_FILTERS: { key: ShipmentStatus; label: string }[] = [
  { key: "returned", label: "Returned" },
  { key: "cancelled", label: "Cancelled" },
];

type ViewMode = "loot" | "list";

export default function DashboardPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("loot");
  const [activeGroup, setActiveGroup] = useState<string | undefined>();
  const [extraFilter, setExtraFilter] = useState<ShipmentStatus | undefined>();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedShipmentId, setSelectedShipmentId] = useState<number | null>(null);
  const [accountFilter, setAccountFilter] = useState<string | undefined>();
  const [accounts, setAccounts] = useState<{ email: string }[]>([]);

  useEffect(() => {
    fetch("/api/auth/status")
      .then((res) => res.json())
      .then((data) => setAccounts(data.accounts || []))
      .catch(() => {});
  }, []);

  const activeStatuses = activeGroup
    ? STATUS_GROUPS.find((g) => g.key === activeGroup)?.statuses
    : undefined;

  const { shipments, total, statusCounts, isLoading, refetch } = useShipments({
    statuses: activeStatuses as ShipmentStatus[] | undefined,
    status: extraFilter,
    search,
    accountEmail: accountFilter,
  });

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
  }, []);

  const handleStatusChange = useCallback(async (id: number, status: string) => {
    await fetch(`/api/shipments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    refetch();
  }, [refetch]);

  function toggleGroup(key: string) {
    setExtraFilter(undefined);
    setActiveGroup(activeGroup === key ? undefined : key);
  }

  function toggleExtra(key: ShipmentStatus) {
    setActiveGroup(undefined);
    setExtraFilter(extraFilter === key ? undefined : key);
  }

  return (
    <div className="space-y-4">
      {/* Row 1: tabs + sync */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center rounded-lg border bg-muted p-1 font-poppins">
          <button
            onClick={() => setViewMode("loot")}
            className={cn(
              "flex items-center gap-2 rounded-md px-4 py-1.5 text-lg font-medium transition-all",
              viewMode === "loot"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Gem className="h-4 w-4" />
            Loot Grid
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={cn(
              "flex items-center gap-2 rounded-md px-4 py-1.5 text-lg font-medium transition-all",
              viewMode === "list"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <ClipboardList className="h-4 w-4" />
            Item List
          </button>
        </div>
        <SyncButton />
      </div>

      {/* Row 2: search + status pills + filter ... add shipment */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-80">
          <SearchBar value={search} onChange={handleSearch} />
        </div>
        <button
          onClick={() => { setActiveGroup(undefined); setExtraFilter(undefined); }}
          className={cn(
            "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap transition-all cursor-pointer",
            !activeGroup && !extraFilter
              ? "bg-foreground text-background border-foreground"
              : "bg-muted text-muted-foreground border-muted"
          )}
        >
          All Items: {statusCounts.all || 0}
        </button>
        {STATUS_GROUPS.map((group) => {
          const count = group.statuses.reduce((sum, s) => sum + (statusCounts[s] || 0), 0);
          const isActive = activeGroup === group.key;
          return (
            <button
              key={group.key}
              onClick={() => toggleGroup(group.key)}
              className={cn(
                "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap transition-all cursor-pointer",
                isActive ? group.activeColor : group.color
              )}
            >
              {group.label}: {count}
            </button>
          );
        })}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
                extraFilter
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Filter className="h-3.5 w-3.5" />
              {extraFilter
                ? MORE_FILTERS.find((f) => f.key === extraFilter)?.label
                : "Filter"}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {MORE_FILTERS.map(({ key, label }) => (
              <DropdownMenuItem
                key={key}
                onClick={() => toggleExtra(key)}
                className={cn(extraFilter === key && "font-semibold")}
              >
                {label}
                {extraFilter === key && <span className="ml-auto text-xs">✓</span>}
              </DropdownMenuItem>
            ))}
            {extraFilter && (
              <DropdownMenuItem onClick={() => setExtraFilter(undefined)} className="text-muted-foreground">
                Clear filter
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        {accounts.length > 1 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
                  accountFilter
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Users className="h-3.5 w-3.5" />
                {accountFilter
                  ? accountFilter.split("@")[0]
                  : "All accounts"}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => setAccountFilter(undefined)}
                className={cn(!accountFilter && "font-semibold")}
              >
                All accounts
                {!accountFilter && <span className="ml-auto text-xs">✓</span>}
              </DropdownMenuItem>
              {accounts.map((acc) => (
                <DropdownMenuItem
                  key={acc.email}
                  onClick={() => setAccountFilter(acc.email)}
                  className={cn(accountFilter === acc.email && "font-semibold")}
                >
                  {acc.email.split("@")[0]}
                  {accountFilter === acc.email && <span className="ml-auto text-xs">✓</span>}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Button variant="outline" className="ml-auto gap-1.5" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4" />
          Add Shipment
        </Button>
      </div>

      {/* View */}
      {viewMode === "loot" ? (
        <LootTimeline shipments={shipments} isLoading={isLoading} onStatusChange={handleStatusChange} onSelect={setSelectedShipmentId} filterKey={[activeGroup, extraFilter, search].filter(Boolean).join("|") || undefined} />
      ) : (
        <ShipmentList shipments={shipments} isLoading={isLoading} onSelect={setSelectedShipmentId} />
      )}

      {total > 0 && (
        <p className="text-sm text-muted-foreground">
          Showing {shipments.length} of {total} shipments
        </p>
      )}

      {showForm && (
        <ShipmentForm
          open={showForm}
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false);
            refetch();
          }}
        />
      )}

      <ShipmentPanel
        shipmentId={selectedShipmentId}
        onClose={() => setSelectedShipmentId(null)}
        onDeleted={refetch}
      />
    </div>
  );
}
