import {
  eq,
  desc,
  asc,
  like,
  or,
  inArray,
  sql,
  count,
  notInArray,
} from "drizzle-orm";
import { db } from "@/lib/db";
import {
  shipments,
  shipmentImages,
  type ShipmentStatus,
} from "@/lib/db/schema";
import type { ShipmentWithImages } from "@/types/shipment";

export interface ShipmentFilters {
  status?: ShipmentStatus;
  statuses?: ShipmentStatus[];
  carrier?: string;
  search?: string;
  sort?: string;
  order?: "asc" | "desc";
  page?: number;
  limit?: number;
  accountEmail?: string;
}

export async function getShipments(
  filters: ShipmentFilters = {}
): Promise<{ shipments: ShipmentWithImages[]; total: number }> {
  const {
    status,
    statuses,
    carrier,
    search,
    sort = "updatedAt",
    order = "desc",
    page = 1,
    limit = 500,
    accountEmail,
  } = filters;

  const conditions = [];

  if (statuses && statuses.length > 0) {
    conditions.push(inArray(shipments.status, statuses));
  } else if (status) {
    conditions.push(eq(shipments.status, status));
  }

  if (carrier) {
    conditions.push(eq(shipments.carrier, carrier));
  }

  if (accountEmail) {
    conditions.push(eq(shipments.accountEmail, accountEmail));
  }

  if (search) {
    const searchPattern = `%${search}%`;
    conditions.push(
      or(
        like(shipments.itemName, searchPattern),
        like(shipments.orderNumber, searchPattern),
        like(shipments.trackingNumber, searchPattern),
        like(shipments.retailer, searchPattern)
      )
    );
  }

  const whereClause =
    conditions.length > 0
      ? sql`${conditions.reduce((acc, cond, i) => (i === 0 ? cond : sql`${acc} AND ${cond}`))}`
      : undefined;

  // Get total count
  const [{ value: total }] = await db
    .select({ value: count() })
    .from(shipments)
    .where(whereClause);

  // Get shipments
  const sortColumn = getSortColumn(sort);
  const orderFn = order === "asc" ? asc : desc;

  const rows = await db
    .select()
    .from(shipments)
    .where(whereClause)
    .orderBy(orderFn(sortColumn))
    .limit(limit)
    .offset((page - 1) * limit);

  // Get images for all shipments
  const shipmentIds = rows.map((r) => r.id);
  const images =
    shipmentIds.length > 0
      ? await db
          .select()
          .from(shipmentImages)
          .where(
            sql`${shipmentImages.shipmentId} IN (${sql.join(
              shipmentIds.map((id) => sql`${id}`),
              sql`, `
            )})`
          )
      : [];

  const result: ShipmentWithImages[] = rows.map((row) => {
    const rowImages = images.filter((img) => img.shipmentId === row.id);
    return {
      ...row,
      images: rowImages,
      primaryImage: rowImages.find((img) => img.isPrimary) || rowImages[0],
    };
  });

  return { shipments: result, total };
}

export async function getShipmentById(
  id: number
): Promise<ShipmentWithImages | null> {
  const row = await db
    .select()
    .from(shipments)
    .where(eq(shipments.id, id))
    .get();

  if (!row) return null;

  const images = await db
    .select()
    .from(shipmentImages)
    .where(eq(shipmentImages.shipmentId, id));

  return {
    ...row,
    images,
    primaryImage: images.find((img) => img.isPrimary) || images[0],
  };
}

export async function getStatusCounts(
  accountEmail?: string
): Promise<Record<string, number>> {
  const rows = await db
    .select({
      status: shipments.status,
      count: count(),
    })
    .from(shipments)
    .where(accountEmail ? eq(shipments.accountEmail, accountEmail) : undefined)
    .groupBy(shipments.status);

  const counts: Record<string, number> = { all: 0 };
  for (const row of rows) {
    counts[row.status] = row.count;
    counts.all += row.count;
  }

  return counts;
}

function getSortColumn(sort: string) {
  switch (sort) {
    case "itemName":
      return shipments.itemName;
    case "retailer":
      return shipments.retailer;
    case "status":
      return shipments.status;
    case "carrier":
      return shipments.carrier;
    case "estimatedDelivery":
      return shipments.estimatedDelivery;
    case "purchaseDate":
      return shipments.purchaseDate;
    case "createdAt":
      return shipments.createdAt;
    default:
      return shipments.updatedAt;
  }
}
