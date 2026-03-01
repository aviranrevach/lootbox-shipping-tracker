"use client";

import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, PackageCheck, XCircle } from "lucide-react";
import type { ShipmentWithImages } from "@/types/shipment";
import { STATUS_LABELS, STATUS_COLORS, STATUS_DOT_COLORS } from "@/types/shipment";

interface LootCardProps {
  shipment: ShipmentWithImages;
  onStatusChange?: (id: number, status: string) => void;
  onSelect?: (id: number) => void;
}

function imageSrc(filePath: string) {
  return `/api/images/${filePath.replace(/^\.?\/?data\/images\//, "")}`;
}

export function LootCard({ shipment, onStatusChange, onSelect }: LootCardProps) {
  const images = shipment.images;

  return (
    <div>
      {/* Card */}
      <div
        className="rounded-2xl border bg-card shadow-sm transition-all hover:shadow-md hover:scale-[1.02] p-2 cursor-pointer"
        onClick={() => onSelect?.(shipment.id)}
      >
        {/* Image */}
        {images.length === 0 ? (
          <div className="flex aspect-[11/10] items-center justify-center rounded-xl bg-muted text-muted-foreground text-2xl">
            ?
          </div>
        ) : images.length === 1 ? (
          <img
            src={imageSrc(images[0].filePath)}
            alt=""
            className="aspect-[11/10] w-full rounded-xl object-cover"
          />
        ) : (
          <div className="grid grid-cols-2 gap-1 aspect-[11/10] overflow-hidden">
            {images.slice(0, 4).map((img) => (
              <img
                key={img.id}
                src={imageSrc(img.filePath)}
                alt=""
                className="h-full w-full rounded-lg object-cover min-h-0"
              />
            ))}
          </div>
        )}

        {/* Status button — inside card, below image */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "flex items-center justify-center w-full rounded-lg border mt-1.5 py-0.5 text-[11px] font-medium cursor-pointer",
                "hover:brightness-95 transition-all outline-none",
                STATUS_COLORS[shipment.status]
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <span className="flex-1 text-center">{STATUS_LABELS[shipment.status]}</span>
              <ChevronDown className="h-3 w-3 opacity-40 mr-2" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)]" onClick={(e) => e.stopPropagation()}>
            <p className="px-2 py-1 text-[10px] text-muted-foreground font-medium">Change manually</p>
            <DropdownMenuItem className="py-2" onClick={() => onStatusChange?.(shipment.id, "delivered")}>
              <PackageCheck className="h-4 w-4 text-green-500" />
              Collected
            </DropdownMenuItem>
            <DropdownMenuItem className="py-2" onClick={() => onStatusChange?.(shipment.id, "cancelled")}>
              <XCircle className="h-4 w-4 text-slate-400" />
              Cancelled
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Item name — outside the card */}
      <p className="mt-2 px-1 text-sm font-medium truncate">
        {shipment.itemName || "Unknown Item"}
      </p>
      {shipment.accountEmail && (
        <p className="px-1 text-xs text-muted-foreground truncate">
          {shipment.accountEmail.split("@")[0]}
        </p>
      )}
    </div>
  );
}
