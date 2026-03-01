"use client";

import { format, differenceInDays, isToday, isTomorrow } from "date-fns";
import {
  AlertTriangle,
  ChevronDown,
  ExternalLink,
  Package,
  Truck,
  CheckCircle2,
  Clock,
  MapPin,
  Ban,
  CircleDot,
  Undo2,
  HelpCircle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ShipmentWithImages } from "@/types/shipment";
import type { ShipmentStatus } from "@/lib/db/schema";

interface ShipmentListProps {
  shipments: ShipmentWithImages[];
  isLoading?: boolean;
  onSelect?: (id: number) => void;
}

const STATUS_CONFIG: Record<
  ShipmentStatus,
  { label: string; icon: React.ElementType; bg: string; text: string }
> = {
  ordered: { label: "Ordered", icon: Clock, bg: "bg-blue-50", text: "text-blue-700" },
  shipped: { label: "Shipped", icon: Package, bg: "bg-indigo-50", text: "text-indigo-700" },
  in_transit: { label: "In Transit", icon: Truck, bg: "bg-yellow-50", text: "text-yellow-700" },
  customs_held: { label: "Customs Held", icon: AlertTriangle, bg: "bg-orange-50", text: "text-orange-700" },
  out_for_delivery: { label: "Out for Delivery", icon: Truck, bg: "bg-amber-50", text: "text-amber-700" },
  ready_for_pickup: { label: "Ready for Pickup", icon: MapPin, bg: "bg-purple-50", text: "text-purple-700" },
  delivered: { label: "Delivered", icon: CheckCircle2, bg: "bg-green-50", text: "text-green-700" },
  picked_up: { label: "Picked Up", icon: CheckCircle2, bg: "bg-emerald-50", text: "text-emerald-700" },
  returned: { label: "Returned", icon: Undo2, bg: "bg-gray-50", text: "text-gray-600" },
  stuck: { label: "Stuck", icon: AlertTriangle, bg: "bg-red-50", text: "text-red-700" },
  overdue: { label: "Overdue", icon: AlertTriangle, bg: "bg-red-50", text: "text-red-700" },
  cancelled: { label: "Cancelled", icon: Ban, bg: "bg-slate-50", text: "text-slate-600" },
  lost: { label: "Lost", icon: HelpCircle, bg: "bg-gray-100", text: "text-gray-700" },
};

function getOverdueLabel(shipment: ShipmentWithImages): string | null {
  if (shipment.status !== "overdue" || !shipment.estimatedDelivery) return null;
  try {
    const days = differenceInDays(new Date(), new Date(shipment.estimatedDelivery));
    if (days > 0) return `${days}d overdue`;
  } catch {}
  return null;
}

function getArrivingSoonLabel(shipment: ShipmentWithImages): string | null {
  if (!shipment.estimatedDelivery) return null;
  if (["delivered", "picked_up", "cancelled", "returned", "lost"].includes(shipment.status)) return null;
  try {
    const eta = new Date(shipment.estimatedDelivery);
    if (isToday(eta)) return "Arriving Today";
    if (isTomorrow(eta)) return "Arriving Soon";
  } catch {}
  return null;
}

function StatusPill({ shipment }: { shipment: ShipmentWithImages }) {
  const config = STATUS_CONFIG[shipment.status];
  const Icon = config.icon;
  const overdueLabel = getOverdueLabel(shipment);
  const arrivingLabel = getArrivingSoonLabel(shipment);

  const label = overdueLabel || arrivingLabel || config.label;
  const bg = arrivingLabel && !overdueLabel ? "bg-green-50" : config.bg;
  const text = arrivingLabel && !overdueLabel ? "text-green-700" : config.text;
  const icon = arrivingLabel && !overdueLabel ? CheckCircle2 : Icon;
  const FinalIcon = overdueLabel ? AlertTriangle : icon;

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", bg, text)}>
      <FinalIcon className="h-3 w-3" />
      {label}
    </span>
  );
}

function formatETA(shipment: ShipmentWithImages): string {
  if (shipment.actualDelivery) {
    try { return format(new Date(shipment.actualDelivery), "MMM d"); } catch {}
  }
  if (shipment.estimatedDelivery) {
    try { return format(new Date(shipment.estimatedDelivery), "MMM d"); } catch {}
  }
  return "—";
}

function imgSrc(filePath: string) {
  return `/api/images/${filePath.replace(/^\.?\/?data\/images\//, "")}`;
}

function ItemImages({ shipment }: { shipment: ShipmentWithImages }) {
  const images = shipment.images;

  if (images.length === 0) {
    return (
      <div className="flex h-[52px] w-[52px] items-center justify-center rounded-lg bg-muted flex-shrink-0">
        <Package className="h-5 w-5 text-muted-foreground" />
      </div>
    );
  }

  if (images.length === 1) {
    return (
      <img
        src={imgSrc(images[0].filePath)}
        alt=""
        className="h-[52px] w-[52px] rounded-lg object-cover bg-muted flex-shrink-0"
      />
    );
  }

  const visible = images.slice(0, 3);
  const extra = images.length - 3;

  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      {visible.map((img) => (
        <img
          key={img.id}
          src={imgSrc(img.filePath)}
          alt=""
          className="h-[52px] w-[52px] rounded-lg object-cover bg-muted"
        />
      ))}
      {extra > 0 && (
        <div className="flex h-[52px] w-[52px] items-center justify-center rounded-lg bg-muted text-xs font-medium text-muted-foreground flex-shrink-0">
          +{extra}
        </div>
      )}
    </div>
  );
}

export function ShipmentList({ shipments, isLoading, onSelect }: ShipmentListProps) {

  if (isLoading) return <ShipmentListSkeleton />;

  if (shipments.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        No shipments found. Connect your Gmail and sync to get started, or add a shipment manually.
      </div>
    );
  }

  return (
    <div className="rounded-xl border">
      {/* Desktop header — hidden on mobile */}
      <div className="hidden md:grid grid-cols-[168px_1fr_140px_180px_150px_100px_32px] items-center gap-4 border-b px-5 py-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Image</span>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Item</span>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Retailer</span>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Shipping</span>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</span>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">ETA</span>
        <span />
      </div>

      {/* Rows */}
      {shipments.map((shipment) => (
        <div key={shipment.id}>
          {/* Mobile card layout */}
          <div
            className="flex md:hidden items-center gap-3 border-b last:border-b-0 px-4 py-3 cursor-pointer transition-colors hover:bg-muted/40"
            onClick={() => onSelect?.(shipment.id)}
          >
            {shipment.images.length > 0 ? (
              <img
                src={imgSrc(shipment.images[0].filePath)}
                alt=""
                className="h-12 w-12 rounded-lg object-cover bg-muted flex-shrink-0"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted flex-shrink-0">
                <Package className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{shipment.itemName || "Unknown Item"}</p>
              <div className="flex items-center gap-2 mt-1">
                <StatusPill shipment={shipment} />
                {shipment.retailer && (
                  <span className="text-xs text-muted-foreground">{shipment.retailer}</span>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <span className="text-xs text-muted-foreground">{formatETA(shipment)}</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground -rotate-90" />
            </div>
          </div>

          {/* Desktop table row */}
          <div
            className="hidden md:grid grid-cols-[168px_1fr_140px_180px_150px_100px_32px] items-center gap-4 border-b last:border-b-0 px-5 py-3.5 cursor-pointer transition-colors hover:bg-muted/40"
            onClick={() => onSelect?.(shipment.id)}
          >
            <ItemImages shipment={shipment} />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{shipment.itemName || "Unknown Item"}</p>
              {shipment.orderNumber && (
                <p className="text-xs text-muted-foreground truncate">#{shipment.orderNumber}</p>
              )}
            </div>
            <span className="text-sm text-muted-foreground">{shipment.retailer || "—"}</span>
            <div className="min-w-0">
              {shipment.carrier ? (
                <>
                  <p className="text-sm font-medium">{shipment.carrier}</p>
                  {shipment.trackingUrl ? (
                    <a
                      href={shipment.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Track <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  ) : shipment.trackingNumber ? (
                    <p className="text-xs text-muted-foreground truncate">{shipment.trackingNumber}</p>
                  ) : null}
                </>
              ) : (
                <span className="text-xs text-muted-foreground">No tracking yet</span>
              )}
            </div>
            <StatusPill shipment={shipment} />
            <span className="text-sm text-muted-foreground">{formatETA(shipment)}</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ShipmentListSkeleton() {
  return (
    <div className="rounded-xl border">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 border-b last:border-b-0 px-4 py-3">
          <Skeleton className="h-12 w-12 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-2.5 w-24" />
          </div>
          <Skeleton className="h-3.5 w-12" />
        </div>
      ))}
    </div>
  );
}
