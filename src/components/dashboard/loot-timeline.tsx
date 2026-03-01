"use client";

import { useMemo, useState, useEffect } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ShipmentWithImages } from "@/types/shipment";
import { groupShipmentsForTimeline } from "@/lib/shipments/grouping";
import { LootCard } from "./loot-card";

interface LootTimelineProps {
  shipments: ShipmentWithImages[];
  isLoading?: boolean;
  onStatusChange?: (id: number, status: string) => void;
  onSelect?: (id: number) => void;
  filterKey?: string;
}

export function LootTimeline({ shipments, isLoading, onStatusChange, onSelect, filterKey }: LootTimelineProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(
    new Set(["delivered"])
  );

  useEffect(() => {
    if (filterKey) {
      setCollapsed(new Set()); // expand all when a filter is active
    } else {
      setCollapsed(new Set(["delivered"])); // restore default when cleared
    }
  }, [filterKey]);

  const groups = useMemo(
    () => groupShipmentsForTimeline(shipments),
    [shipments]
  );

  if (isLoading) {
    return <LootTimelineSkeleton />;
  }

  if (shipments.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        No shipments found. Connect your Gmail and sync to get started, or add a
        shipment manually.
      </div>
    );
  }

  function toggleGroup(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="space-y-8">
      {groups.map((group) => {
        const isCollapsed = collapsed.has(group.key);
        return (
          <section key={group.key}>
            <button
              className="flex items-center gap-2 mb-4 cursor-pointer font-poppins"
              onClick={() => toggleGroup(group.key)}
            >
              <span className="text-lg font-bold tabular-nums">
                {String(group.shipments.length).padStart(2, "0")}
              </span>
              <h2 className={cn("text-lg font-semibold", group.color)}>
                {group.label}
              </h2>
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            {!isCollapsed && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {group.shipments.map((s) => (
                  <LootCard key={s.id} shipment={s} onStatusChange={onStatusChange} onSelect={onSelect} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function LootTimelineSkeleton() {
  return (
    <div className="space-y-8">
      {Array.from({ length: 3 }).map((_, gi) => (
        <div key={gi} className="space-y-4">
          <Skeleton className="h-7 w-40" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[200px] rounded-xl" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
