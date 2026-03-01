import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { db } from "@/lib/db";
import { shipmentImages } from "@/lib/db/schema";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const shipmentId = parseInt(id);

    const contentType = request.headers.get("content-type") || "";

    // Handle JSON body (save from URL)
    if (contentType.includes("application/json")) {
      const { url } = await request.json();
      if (!url || typeof url !== "string") {
        return NextResponse.json(
          { error: "No URL provided" },
          { status: 400 }
        );
      }

      const dir = path.join("./data/images", String(shipmentId));
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        return NextResponse.json(
          { error: "Failed to download image" },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length < 500) {
        return NextResponse.json(
          { error: "Image too small (likely a pixel)" },
          { status: 400 }
        );
      }

      const respContentType = response.headers.get("content-type") || "";
      let ext = ".jpg";
      if (respContentType.includes("png")) ext = ".png";
      else if (respContentType.includes("webp")) ext = ".webp";
      else if (respContentType.includes("gif")) ext = ".gif";
      else {
        const urlExt = url.match(/\.(jpg|jpeg|png|webp|gif)/i);
        if (urlExt) ext = `.${urlExt[1].toLowerCase()}`;
      }

      const hash = crypto
        .createHash("md5")
        .update(url)
        .digest("hex")
        .slice(0, 8);
      const filename = `picked-${hash}${ext}`;
      const filePath = path.join(dir, filename);

      fs.writeFileSync(filePath, buffer);

      const existing = await db
        .select()
        .from(shipmentImages)
        .where(eq(shipmentImages.shipmentId, shipmentId));

      const [image] = await db
        .insert(shipmentImages)
        .values({
          shipmentId,
          filePath,
          sourceUrl: url,
          source: "email",
          isPrimary: existing.length === 0,
        })
        .returning();

      return NextResponse.json(image, { status: 201 });
    }

    // Handle form data (file upload)
    const formData = await request.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const validTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "application/octet-stream", // blob from data URI pick
    ];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type" },
        { status: 400 }
      );
    }

    const dir = path.join("./data/images", String(shipmentId));
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    let ext = ".jpg";
    if (file.type === "image/png") ext = ".png";
    else if (file.type === "image/webp") ext = ".webp";
    else if (file.type === "image/gif") ext = ".gif";
    else if (file.type === "image/jpeg") ext = ".jpg";
    const hash = crypto.randomBytes(4).toString("hex");
    const filename = `manual-${hash}${ext}`;
    const filePath = path.join(dir, filename);

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    const existing = await db
      .select()
      .from(shipmentImages)
      .where(eq(shipmentImages.shipmentId, shipmentId));

    const [image] = await db
      .insert(shipmentImages)
      .values({
        shipmentId,
        filePath,
        source: "manual",
        isPrimary: existing.length === 0,
      })
      .returning();

    return NextResponse.json(image, { status: 201 });
  } catch (error) {
    console.error("Image upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload image" },
      { status: 500 }
    );
  }
}
