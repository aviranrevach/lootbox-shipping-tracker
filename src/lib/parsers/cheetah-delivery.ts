import type { EmailParser, ParsedShipmentData } from "./types";
import { cleanText } from "./index";
import { extractTrackingNumbers } from "@/lib/tracking/extractor";

export const cheetahDeliveryParser: EmailParser = {
  name: "cheetah-delivery",

  canParse(from: string, subject: string): boolean {
    const fromLower = from.toLowerCase();
    return (
      fromLower.includes("chita-il.com") ||
      fromLower.includes("cheetahdelivery") ||
      fromLower.includes("chitadelivery") ||
      fromLower.includes("cheetah-group")
    );
  },

  parse(
    from: string,
    subject: string,
    htmlBody: string,
    textBody: string
  ): ParsedShipmentData | null {
    const body = textBody || htmlBody.replace(/<[^>]*>/g, " ");
    const combined = subject + " " + body;

    // Extract tracking number — Cheetah uses format like AE039387007 (2 letters + 7-9 digits)
    // Try the body first for explicit "משלוח {number}" pattern
    const hebrewTrackingMatch = combined.match(
      /משלוח\s+([A-Z]{2}\d{7,12})/
    );
    let trackingNumber = hebrewTrackingMatch?.[1];

    // Fallback: generic 2-letter + 7-12 digit pattern in body
    if (!trackingNumber) {
      const genericMatch = combined.match(/\b([A-Z]{2}\d{7,12})\b/);
      trackingNumber = genericMatch?.[1];
    }

    // Also try the standard extractor
    if (!trackingNumber) {
      const tracking = extractTrackingNumbers(body);
      trackingNumber =
        tracking.israelPost[0] || tracking.standard[0]?.trackingNumber;
    }

    if (!trackingNumber) return null;

    // Extract tracking URL — Cheetah uses short links like https://u.cheetahint.com/xxxxx
    let trackingUrl: string | undefined;
    const urlMatch = htmlBody.match(
      /href="(https?:\/\/u\.cheetahint\.com\/[^"]+)"/
    );
    if (urlMatch) {
      trackingUrl = urlMatch[1];
    } else {
      // Try text body
      const textUrlMatch = body.match(
        /(https?:\/\/u\.cheetahint\.com\/\S+)/
      );
      trackingUrl = textUrlMatch?.[1];
    }

    // Determine status from Hebrew keywords
    let status: ParsedShipmentData["status"] = "in_transit";

    if (/נמסר|delivered|הגעה/i.test(combined)) {
      status = "delivered";
    } else if (/ממתין לאיסוף|ready.*pickup|מוכן לאיסוף|איסוף/i.test(combined)) {
      status = "ready_for_pickup";
    } else if (/יצא לחלוקה|out.*delivery|שליח/i.test(combined)) {
      status = "out_for_delivery";
    } else if (/שחרור מהמכס|customs|מכס/i.test(combined)) {
      status = "customs_held";
    } else if (/בדרכו לישראל|on.*way|בדרך|משלוח/i.test(combined)) {
      status = "in_transit";
    } else if (/נשלח|shipped|dispatched/i.test(combined)) {
      status = "shipped";
    }

    // Cheetah is a carrier, not the retailer — we don't know who the sender is
    const itemName = `Shipment ${trackingNumber}`;

    return {
      retailer: "Unknown",
      itemName: cleanText(itemName),
      trackingNumber,
      trackingUrl,
      carrier: "Cheetah",
      originCountry: "IL",
      status,
    };
  },
};
