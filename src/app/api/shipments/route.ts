import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shipments, type ShipmentStatus } from "@/lib/db/schema";
import { getShipments, getStatusCounts } from "@/lib/shipments/queries";
import { getTrackingUrl } from "@/lib/tracking/carrier-map";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;

    const filters = {
      status: params.get("status") as ShipmentStatus | undefined,
      statuses: params.get("statuses")
        ? (params.get("statuses")!.split(",") as ShipmentStatus[])
        : undefined,
      carrier: params.get("carrier") || undefined,
      search: params.get("search") || undefined,
      sort: params.get("sort") || undefined,
      order: (params.get("order") as "asc" | "desc") || undefined,
      page: params.get("page") ? parseInt(params.get("page")!) : undefined,
      limit: params.get("limit") ? parseInt(params.get("limit")!) : undefined,
      accountEmail: params.get("accountEmail") || undefined,
    };

    const [result, statusCounts] = await Promise.all([
      getShipments(filters),
      getStatusCounts(filters.accountEmail),
    ]);

    return NextResponse.json({
      shipments: result.shipments,
      total: result.total,
      statusCounts,
    });
  } catch (error) {
    console.error("Shipments GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch shipments" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const trackingUrl =
      body.trackingNumber && body.carrier
        ? getTrackingUrl(body.carrier, body.trackingNumber)
        : null;

    const [newShipment] = await db
      .insert(shipments)
      .values({
        retailer: body.retailer || null,
        orderNumber: body.orderNumber || null,
        itemName: body.itemName,
        itemDescription: body.itemDescription || null,
        purchaseDate: body.purchaseDate || null,
        status: body.status || "ordered",
        trackingNumber: body.trackingNumber || null,
        carrier: body.carrier || null,
        trackingUrl,
        estimatedDelivery: body.estimatedDelivery || null,
        originCountry: body.originCountry || null,
        isInternational: body.isInternational || false,
        productUrl: body.productUrl || null,
        isManual: true,
        notes: body.notes || null,
        lastStatusUpdate: new Date().toISOString(),
      })
      .returning();

    return NextResponse.json(newShipment, { status: 201 });
  } catch (error) {
    console.error("Shipments POST error:", error);
    return NextResponse.json(
      { error: "Failed to create shipment" },
      { status: 500 }
    );
  }
}
