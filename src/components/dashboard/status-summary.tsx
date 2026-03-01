"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusSummaryProps {
  counts: Record<string, number>;
}

const SUMMARY_ITEMS = [
  {
    label: "On the Way",
    keys: [
      "ordered",
      "shipped",
      "in_transit",
      "customs_held",
      "out_for_delivery",
      "ready_for_pickup",
    ],
    color: "bg-blue-100 text-blue-800 border-blue-200",
  },
  {
    label: "Delivered",
    keys: ["delivered", "picked_up"],
    color: "bg-green-100 text-green-800 border-green-200",
  },
  {
    label: "Attention",
    keys: ["overdue", "stuck", "lost"],
    color: "bg-red-100 text-red-800 border-red-200",
  },
];

export function StatusSummary({ counts }: StatusSummaryProps) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="text-sm font-medium text-muted-foreground">
        {counts.all || 0} shipments
      </span>
      {SUMMARY_ITEMS.map(({ label, keys, color }) => {
        const count = keys.reduce((sum, k) => sum + (counts[k] || 0), 0);
        if (count === 0) return null;
        return (
          <Badge
            key={label}
            variant="outline"
            className={cn(color, "text-xs font-medium")}
          >
            {label}: {count}
          </Badge>
        );
      })}
    </div>
  );
}
