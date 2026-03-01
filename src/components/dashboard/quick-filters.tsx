"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface QuickFiltersProps {
  active?: string;
  onSelect: (filter: string | undefined) => void;
}

const QUICK_FILTERS = [
  { key: "overdue", label: "Overdue" },
  { key: "arriving_soon", label: "Arriving Soon" },
  { key: "pickup", label: "Ready for Pickup" },
  { key: "recent", label: "Recently Delivered" },
  { key: "active", label: "All Active" },
];

export function QuickFilters({ active, onSelect }: QuickFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {QUICK_FILTERS.map(({ key, label }) => (
        <Button
          key={key}
          variant={active === key ? "default" : "outline"}
          size="sm"
          onClick={() => onSelect(active === key ? undefined : key)}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}
