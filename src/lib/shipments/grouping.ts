import { isToday, isTomorrow, differenceInDays, format } from "date-fns";
import type { ShipmentWithImages } from "@/types/shipment";

export interface ShipmentGroup {
  key: string;
  label: string;
  shipments: ShipmentWithImages[];
  color: string;
}

export function groupShipmentsForTimeline(
  shipments: ShipmentWithImages[]
): ShipmentGroup[] {
  const arriving: ShipmentWithImages[] = [];
  const onTheWay: ShipmentWithImages[] = [];
  const delayed: ShipmentWithImages[] = [];
  const ordered: ShipmentWithImages[] = [];
  const delivered: ShipmentWithImages[] = [];

  for (const s of shipments) {
    if (s.status === "delivered" || s.status === "picked_up") {
      delivered.push(s);
    } else if (
      s.status === "overdue" ||
      s.status === "stuck" ||
      s.status === "lost"
    ) {
      delayed.push(s);
    } else if (s.status === "returned" || s.status === "cancelled") {
      delivered.push(s);
    } else if (s.status === "ordered") {
      ordered.push(s);
    } else if (
      s.status === "out_for_delivery" ||
      s.status === "ready_for_pickup" ||
      isArrivingSoon(s)
    ) {
      arriving.push(s);
    } else {
      onTheWay.push(s);
    }
  }

  const groups: ShipmentGroup[] = [];

  if (arriving.length > 0) {
    groups.push({
      key: "arriving",
      label: "Arriving",
      shipments: arriving,
      color: "text-green-700",
    });
  }
  if (onTheWay.length > 0) {
    groups.push({
      key: "on_the_way",
      label: "On the Way",
      shipments: onTheWay,
      color: "text-blue-700",
    });
  }
  if (delayed.length > 0) {
    groups.push({
      key: "delayed",
      label: "Needs Attention",
      shipments: delayed,
      color: "text-red-700",
    });
  }
  if (ordered.length > 0) {
    groups.push({
      key: "ordered",
      label: "Ordered",
      shipments: ordered,
      color: "text-indigo-700",
    });
  }
  if (delivered.length > 0) {
    groups.push({
      key: "delivered",
      label: "Delivered",
      shipments: delivered,
      color: "text-emerald-700",
    });
  }

  return groups;
}

function isArrivingSoon(s: ShipmentWithImages): boolean {
  if (!s.estimatedDelivery) return false;
  try {
    const eta = new Date(s.estimatedDelivery);
    return isToday(eta) || isTomorrow(eta);
  } catch {
    return false;
  }
}

export function getETABadgeInfo(s: ShipmentWithImages): {
  text: string;
  variant: "green" | "blue" | "yellow" | "red" | "gray" | "purple";
} {
  if (s.status === "delivered" || s.status === "picked_up") {
    return { text: "Delivered", variant: "green" };
  }
  if (s.status === "ready_for_pickup") {
    return { text: "Pickup", variant: "purple" };
  }
  if (s.status === "out_for_delivery") {
    return { text: "Today", variant: "green" };
  }
  if (s.status === "overdue" && s.estimatedDelivery) {
    try {
      const days = differenceInDays(new Date(), new Date(s.estimatedDelivery));
      return { text: `${days}d overdue`, variant: "red" };
    } catch {
      return { text: "Overdue", variant: "red" };
    }
  }
  if (s.status === "overdue") {
    return { text: "Overdue", variant: "red" };
  }
  if (s.status === "stuck" || s.status === "lost") {
    return { text: s.status === "stuck" ? "Stuck" : "Lost", variant: "red" };
  }
  if (s.estimatedDelivery) {
    try {
      const eta = new Date(s.estimatedDelivery);
      if (isToday(eta)) return { text: "Today", variant: "green" };
      if (isTomorrow(eta)) return { text: "Tomorrow", variant: "yellow" };
      return { text: format(eta, "MMM d"), variant: "blue" };
    } catch {
      return { text: "No ETA", variant: "gray" };
    }
  }
  return { text: "No ETA", variant: "gray" };
}
