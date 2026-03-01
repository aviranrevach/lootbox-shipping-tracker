"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ShipmentStatus } from "@/types/shipment";

interface StatusCardsProps {
  counts: Record<string, number>;
  activeFilter?: string;
  onFilterChange: (status: string | undefined) => void;
}

const DISPLAY_STATUSES: { key: string; label: string; color: string }[] = [
  { key: "all", label: "All", color: "bg-gray-100 text-gray-900" },
  { key: "ordered", label: "Ordered", color: "bg-blue-100 text-blue-800" },
  { key: "in_transit", label: "In Transit", color: "bg-yellow-100 text-yellow-800" },
  { key: "ready_for_pickup", label: "Pickup", color: "bg-purple-100 text-purple-800" },
  { key: "delivered", label: "Delivered", color: "bg-green-100 text-green-800" },
  { key: "overdue", label: "Overdue", color: "bg-red-200 text-red-900" },
  { key: "stuck", label: "Stuck", color: "bg-red-100 text-red-800" },
];

export function StatusCards({
  counts,
  activeFilter,
  onFilterChange,
}: StatusCardsProps) {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-7">
      {DISPLAY_STATUSES.map(({ key, label, color }) => {
        const count = counts[key] || 0;
        const isActive = activeFilter === key || (!activeFilter && key === "all");

        return (
          <Card
            key={key}
            className={cn(
              "cursor-pointer transition-all hover:shadow-md",
              isActive && "ring-2 ring-primary"
            )}
            onClick={() =>
              onFilterChange(key === "all" ? undefined : key)
            }
          >
            <CardContent className="p-3 text-center">
              <div className={cn("inline-block rounded-md px-2 py-0.5 text-xs font-medium", color)}>
                {label}
              </div>
              <div className="mt-1 text-2xl font-bold">{count}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
