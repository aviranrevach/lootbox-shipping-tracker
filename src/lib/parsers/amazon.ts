import type { EmailParser, ParsedShipmentData } from "./types";
import { cleanText, itemNameFromSubject } from "./index";
import { extractTrackingNumbers } from "@/lib/tracking/extractor";

export const amazonParser: EmailParser = {
  name: "amazon",

  canParse(from: string): boolean {
    const fromLower = from.toLowerCase();
    return (
      fromLower.includes("amazon.com") ||
      fromLower.includes("amazon.co.il") ||
      fromLower.includes("amazon.co.uk") ||
      fromLower.includes("amazon.de")
    );
  },

  parse(
    from: string,
    subject: string,
    htmlBody: string,
    textBody: string
  ): ParsedShipmentData | null {
    const body = textBody || htmlBody.replace(/<[^>]*>/g, " ");
    const subjectLower = subject.toLowerCase();

    // Determine status from subject
    let status: ParsedShipmentData["status"] = "ordered";
    if (
      subjectLower.includes("shipped") ||
      subjectLower.includes("has shipped")
    ) {
      status = "shipped";
    } else if (subjectLower.includes("delivered")) {
      status = "delivered";
    } else if (subjectLower.includes("out for delivery")) {
      status = "out_for_delivery";
    } else if (
      subjectLower.includes("order confirmed") ||
      subjectLower.includes("order of")
    ) {
      status = "ordered";
    }

    // Extract order number: 123-1234567-1234567
    const orderMatch = body.match(/\b(\d{3}-\d{7}-\d{7})\b/);
    const orderNumber = orderMatch?.[1];

    // Extract item name - try multiple approaches
    let itemName: string | undefined;

    // 1. Subject line: "Your Amazon.com order of ITEM has shipped"
    const orderOf = subject.match(/order of\s+(.+?)(?:\s+has|\s*$)/i);
    if (orderOf) {
      const cleaned = cleanText(orderOf[1]);
      if (cleaned.length > 3) itemName = cleaned;
    }

    // 2. Subject line: "Shipped: ITEM"
    if (!itemName) {
      const shipSubject = subject.match(
        /(?:Shipped|Delivered|Your).*?:\s*(.+?)(?:\s*-\s*|$)/i
      );
      if (shipSubject) {
        const cleaned = cleanText(shipSubject[1]);
        if (cleaned.length > 3) itemName = cleaned;
      }
    }

    // 3. Body text patterns
    if (!itemName) {
      const itemMatch = body.match(
        /(?:Items? ordered|Product)[\s:]*\n?\s*(.{5,100})(?:\n|Qty|Sold by)/i
      );
      if (itemMatch) {
        const cleaned = cleanText(itemMatch[1]);
        if (cleaned.length > 4) itemName = cleaned.substring(0, 200);
      }
    }

    // 4. Fallback to cleaned subject
    if (!itemName) {
      itemName = itemNameFromSubject(subject, "Amazon");
    }

    // Extract tracking
    const tracking = extractTrackingNumbers(body);
    const trackingNumber =
      tracking.standard[0]?.trackingNumber || tracking.israelPost[0];
    const carrier = tracking.standard[0]?.courier?.name;

    // Extract product URL from HTML
    let productUrl: string | undefined;
    const urlMatch = htmlBody.match(
      /href="(https?:\/\/(?:www\.)?amazon\.[^"]*\/(?:gp\/product|dp)\/[^"]+)"/i
    );
    if (urlMatch) {
      productUrl = urlMatch[1];
    }

    // Extract image URLs from email HTML
    const imageUrls: string[] = [];
    const imgRegex =
      /(?:src|data-src)="(https?:\/\/[^"]*(?:images-amazon|m\.media-amazon|images-na)[^"]*(?:\.jpg|\.png|\.webp)[^"]*)"/gi;
    let imgMatch;
    while ((imgMatch = imgRegex.exec(htmlBody)) !== null) {
      if (
        !imgMatch[1].includes("transparent") &&
        !imgMatch[1].includes("pixel") &&
        !imgMatch[1].includes("spacer")
      ) {
        imageUrls.push(imgMatch[1]);
      }
    }

    // Extract estimated delivery
    let estimatedDelivery: string | undefined;
    const deliveryMatch = body.match(
      /(?:arriving|delivery|deliver by|estimated delivery)[:\s]*(?:on\s+)?(\w+(?:day)?,?\s+\w+\s+\d{1,2}(?:,?\s+\d{4})?)/i
    );
    if (deliveryMatch) {
      try {
        const parsed = new Date(deliveryMatch[1]);
        if (!isNaN(parsed.getTime())) {
          estimatedDelivery = parsed.toISOString().split("T")[0];
        }
      } catch {
        // ignore
      }
    }

    if (!orderNumber && !trackingNumber) {
      return null;
    }

    return {
      retailer: "Amazon",
      orderNumber,
      itemName: cleanText(itemName || `Amazon Order ${orderNumber || ""}`),
      trackingNumber,
      carrier,
      estimatedDelivery,
      productUrl,
      imageUrls: imageUrls.slice(0, 5),
      originCountry: "US",
      status,
    };
  },
};
