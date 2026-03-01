import { eq, and, notInArray } from "drizzle-orm";
import { differenceInDays } from "date-fns";
import { db } from "@/lib/db";
import { shipments, settings } from "@/lib/db/schema";
import type { ShipmentStatus } from "@/lib/db/schema";

interface OverdueConfig {
  domesticDays: number;
  internationalDays: number;
  chinaDays: number;
  israelDomesticDays: number;
  stuckDays: number;
}

const DEFAULT_CONFIG: OverdueConfig = {
  domesticDays: 7,
  internationalDays: 30,
  chinaDays: 45,
  israelDomesticDays: 5,
  stuckDays: 7,
};

async function getOverdueConfig(): Promise<OverdueConfig> {
  const rows = await db.select().from(settings);
  const config = { ...DEFAULT_CONFIG };

  for (const row of rows) {
    switch (row.key) {
      case "overdue_domestic_days":
        config.domesticDays = parseInt(row.value) || DEFAULT_CONFIG.domesticDays;
        break;
      case "overdue_international_days":
        config.internationalDays =
          parseInt(row.value) || DEFAULT_CONFIG.internationalDays;
        break;
      case "overdue_china_days":
        config.chinaDays = parseInt(row.value) || DEFAULT_CONFIG.chinaDays;
        break;
      case "overdue_israel_domestic_days":
        config.israelDomesticDays =
          parseInt(row.value) || DEFAULT_CONFIG.israelDomesticDays;
        break;
      case "overdue_stuck_days":
        config.stuckDays = parseInt(row.value) || DEFAULT_CONFIG.stuckDays;
        break;
    }
  }

  return config;
}

function getThresholdDays(
  originCountry: string | null,
  isInternational: boolean | null,
  config: OverdueConfig
): number {
  const country = (originCountry || "").toUpperCase();

  if (country === "CN") return config.chinaDays;
  if (country === "IL" && !isInternational) return config.israelDomesticDays;
  if (isInternational) return config.internationalDays;
  return config.domesticDays;
}

export async function updateOverdueStatuses(): Promise<number> {
  const config = await getOverdueConfig();
  const now = new Date();
  let updated = 0;

  // Skip terminal statuses
  const terminalStatuses: ShipmentStatus[] = [
    "delivered",
    "picked_up",
    "returned",
    "cancelled",
    "lost",
  ];

  const activeShipments = await db
    .select()
    .from(shipments)
    .where(notInArray(shipments.status, terminalStatuses));

  for (const shipment of activeShipments) {
    let newStatus: ShipmentStatus | null = null;

    // Check if past estimated delivery
    if (shipment.estimatedDelivery) {
      const daysOverdue = differenceInDays(
        now,
        new Date(shipment.estimatedDelivery)
      );
      if (daysOverdue > 2) {
        newStatus = "overdue";
      }
    }

    // Check for stuck: in transit with no update
    if (
      shipment.status === "in_transit" &&
      shipment.lastStatusUpdate
    ) {
      const daysSinceUpdate = differenceInDays(
        now,
        new Date(shipment.lastStatusUpdate)
      );
      if (daysSinceUpdate > config.stuckDays) {
        newStatus = "stuck";
      }
    }

    // Check threshold-based overdue
    if (!newStatus && shipment.purchaseDate) {
      const daysSinceOrder = differenceInDays(
        now,
        new Date(shipment.purchaseDate)
      );
      const threshold = getThresholdDays(
        shipment.originCountry,
        shipment.isInternational,
        config
      );
      if (daysSinceOrder > threshold) {
        newStatus = "overdue";
      }
    }

    if (newStatus && newStatus !== shipment.status) {
      await db
        .update(shipments)
        .set({
          status: newStatus,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(shipments.id, shipment.id));
      updated++;
    }
  }

  return updated;
}
