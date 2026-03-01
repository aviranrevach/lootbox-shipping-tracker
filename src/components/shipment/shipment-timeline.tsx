"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ShipmentStatus } from "@/types/shipment";
import {
  STATUS_LABELS,
  STATUS_DOT_COLORS,
  STATUS_GROUPS,
} from "@/types/shipment";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ShipmentTimelineProps {
  currentStatus: ShipmentStatus;
  purchaseDate?: string | null;
  actualDelivery?: string | null;
  onStatusChange?: (status: ShipmentStatus) => void;
}

const TIMELINE_STEPS: ShipmentStatus[] = [
  "ordered",
  "shipped",
  "in_transit",
  "out_for_delivery",
  "picked_up",
];

const STATUS_INDEX: Record<string, number> = {};
TIMELINE_STEPS.forEach((s, i) => (STATUS_INDEX[s] = i));

export function ShipmentTimeline({
  currentStatus,
  purchaseDate,
  actualDelivery,
  onStatusChange,
}: ShipmentTimelineProps) {
  const currentIndex = STATUS_INDEX[currentStatus] ?? -1;
  const isTerminal = ["cancelled", "lost", "returned"].includes(currentStatus);

  return (
    <div className="w-full">
      <div className="flex items-start">
        {TIMELINE_STEPS.map((step, i) => {
          const isCompleted = currentIndex >= i;
          const isCurrent = currentStatus === step;
          const isLast = i === TIMELINE_STEPS.length - 1;

          let dateLabel = "";
          if (step === "ordered" && purchaseDate) dateLabel = purchaseDate;
          if (step === "picked_up" && actualDelivery) dateLabel = actualDelivery;

          const circle = (
            <div
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-medium transition-colors",
                onStatusChange && "cursor-pointer hover:ring-2 hover:ring-primary/30",
                isCompleted
                  ? "border-primary bg-primary text-primary-foreground"
                  : isCurrent
                    ? "border-primary bg-background text-primary"
                    : "border-muted-foreground/25 bg-background text-muted-foreground/50"
              )}
              title={STATUS_LABELS[step]}
            >
              {isCompleted ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
          );

          return (
            <div key={step} className="flex flex-1 flex-col items-center">
              {/* Node + connector row */}
              <div className="flex w-full items-center">
                {/* Left connector */}
                {i > 0 ? (
                  <div
                    className={cn(
                      "h-0.5 flex-1",
                      isCompleted ? "bg-primary" : "bg-muted-foreground/20"
                    )}
                  />
                ) : (
                  <div className="flex-1" />
                )}

                {/* Circle — with dropdown if interactive */}
                {onStatusChange ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      {circle}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="center" className="w-48">
                      {STATUS_GROUPS.map((group, gi) => (
                        <DropdownMenuGroup key={group.label}>
                          {gi > 0 && <DropdownMenuSeparator />}
                          <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
                          {group.statuses.map((s) => (
                            <DropdownMenuItem
                              key={s}
                              onClick={() => onStatusChange(s)}
                              className={cn(
                                "gap-2",
                                s === currentStatus && "font-semibold"
                              )}
                            >
                              <span className={cn("inline-block size-2 rounded-full shrink-0", STATUS_DOT_COLORS[s])} />
                              {STATUS_LABELS[s]}
                              {s === currentStatus && (
                                <Check className="ml-auto h-3.5 w-3.5 text-primary" />
                              )}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuGroup>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  circle
                )}

                {/* Right connector */}
                {!isLast ? (
                  <div
                    className={cn(
                      "h-0.5 flex-1",
                      isCompleted && currentIndex > i
                        ? "bg-primary"
                        : "bg-muted-foreground/20"
                    )}
                  />
                ) : (
                  <div className="flex-1" />
                )}
              </div>

              {/* Label */}
              <p
                className={cn(
                  "mt-2 text-center text-[11px] font-medium leading-tight",
                  isCompleted
                    ? "text-foreground"
                    : "text-muted-foreground/60"
                )}
              >
                {STATUS_LABELS[step]}
              </p>
              {dateLabel && (
                <p className="text-[10px] text-muted-foreground text-center">
                  {dateLabel}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {isTerminal && (
        <div className="mt-3 flex items-center justify-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-destructive bg-destructive text-destructive-foreground text-xs">
            !
          </div>
          <p className="text-sm font-medium text-destructive">
            {STATUS_LABELS[currentStatus]}
          </p>
        </div>
      )}
    </div>
  );
}
