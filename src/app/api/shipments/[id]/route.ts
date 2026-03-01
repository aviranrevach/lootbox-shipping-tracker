import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { shipments, shipmentImages } from "@/lib/db/schema";
import { getShipmentById } from "@/lib/shipments/queries";
import { getTrackingUrl } from "@/lib/tracking/carrier-map";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const shipment = await getShipmentById(parseInt(id));

    if (!shipment) {
      return NextResponse.json(
        { error: "Shipment not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(shipment);
  } catch (error) {
    console.error("Shipment GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch shipment" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const shipmentId = parseInt(id);

    // Build tracking URL if tracking info changed
    if (body.trackingNumber && body.carrier) {
      body.trackingUrl = getTrackingUrl(body.carrier, body.trackingNumber);
    }

    body.updatedAt = new Date().toISOString();
    if (body.status) {
      body.lastStatusUpdate = new Date().toISOString();
    }

    const [updated] = await db
      .update(shipments)
      .set(body)
      .where(eq(shipments.id, shipmentId))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: "Shipment not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Shipment PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update shipment" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const shipmentId = parseInt(id);

    // Images cascade-delete via schema FK
    const [deleted] = await db
      .delete(shipments)
      .where(eq(shipments.id, shipmentId))
      .returning();

    if (!deleted) {
      return NextResponse.json(
        { error: "Shipment not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Shipment DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete shipment" },
      { status: 500 }
    );
  }
}
