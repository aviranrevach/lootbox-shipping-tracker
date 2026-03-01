import type { InferSelectModel } from "drizzle-orm";
import type { shipments, shipmentImages } from "@/lib/db/schema";
import type { ShipmentStatus } from "@/lib/db/schema";

export type Shipment = InferSelectModel<typeof shipments>;
export type ShipmentImage = InferSelectModel<typeof shipmentImages>;

export type ShipmentWithImages = Shipment & {
  images: ShipmentImage[];
  primaryImage?: ShipmentImage;
};

export type { ShipmentStatus };

export const STATUS_LABELS: Record<ShipmentStatus, string> = {
  ordered: "Ordered",
  shipped: "Shipped",
  in_transit: "In Transit",
  customs_held: "Customs Held",
  out_for_delivery: "Out for Delivery",
  ready_for_pickup: "Ready for Pickup",
  delivered: "Delivered",
  picked_up: "Picked Up",
  returned: "Returned",
  stuck: "Stuck",
  overdue: "Overdue",
  cancelled: "Cancelled",
  lost: "Lost",
};

export const STATUS_COLORS: Record<ShipmentStatus, string> = {
  ordered: "bg-blue-100 text-blue-800 border-blue-200",
  shipped: "bg-indigo-100 text-indigo-800 border-indigo-200",
  in_transit: "bg-yellow-100 text-yellow-800 border-yellow-200",
  customs_held: "bg-orange-100 text-orange-800 border-orange-200",
  out_for_delivery: "bg-amber-100 text-amber-800 border-amber-200",
  ready_for_pickup: "bg-purple-100 text-purple-800 border-purple-200",
  delivered: "bg-green-100 text-green-800 border-green-200",
  picked_up: "bg-emerald-100 text-emerald-800 border-emerald-200",
  returned: "bg-gray-100 text-gray-800 border-gray-200",
  stuck: "bg-red-100 text-red-800 border-red-200",
  overdue: "bg-red-200 text-red-900 border-red-300",
  cancelled: "bg-slate-100 text-slate-800 border-slate-200",
  lost: "bg-gray-200 text-gray-900 border-gray-300",
};

export const STATUS_DOT_COLORS: Record<ShipmentStatus, string> = {
  ordered: "bg-blue-500",
  shipped: "bg-indigo-500",
  in_transit: "bg-yellow-500",
  customs_held: "bg-orange-500",
  out_for_delivery: "bg-amber-500",
  ready_for_pickup: "bg-purple-500",
  delivered: "bg-green-500",
  picked_up: "bg-emerald-500",
  returned: "bg-gray-400",
  stuck: "bg-red-500",
  overdue: "bg-red-600",
  cancelled: "bg-slate-400",
  lost: "bg-gray-500",
};

export const STATUS_GROUPS: { label: string; statuses: ShipmentStatus[] }[] = [
  {
    label: "Arrived",
    statuses: ["picked_up", "delivered", "ready_for_pickup"],
  },
  {
    label: "Active",
    statuses: ["out_for_delivery", "in_transit", "customs_held", "shipped", "ordered"],
  },
  {
    label: "Issues",
    statuses: ["stuck", "overdue", "returned", "cancelled", "lost"],
  },
];
