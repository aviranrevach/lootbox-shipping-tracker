import type { EmailParser, ParsedShipmentData } from "./types";
import { cleanText, itemNameFromSubject } from "./index";
import { extractTrackingNumbers } from "@/lib/tracking/extractor";

const ISRAELI_DOMAINS = [
  "ksp.co.il",
  "ivory.co.il",
  "bug.co.il",
  "zap.co.il",
  "next.co.il",
  "mahsanei-hashmal.co.il",
  "shufersal.co.il",
];

function identifyRetailer(from: string): string | null {
  const fromLower = from.toLowerCase();
  for (const domain of ISRAELI_DOMAINS) {
    if (fromLower.includes(domain)) {
      return domain.split(".")[0].toUpperCase();
    }
  }
  return null;
}

export const israeliRetailersParser: EmailParser = {
  name: "israeli-retailers",

  canParse(from: string, subject: string): boolean {
    const fromLower = from.toLowerCase();
    const isIsraeliDomain = ISRAELI_DOMAINS.some((d) =>
      fromLower.includes(d)
    );
    // Also catch Hebrew shipping keywords from any sender
    const hasHebrewShipping =
      /משלוח|הזמנה|נשלח|הגעה|איסוף|שליח|מעקב משלוח|דואר ישראל/.test(subject);
    return isIsraeliDomain || hasHebrewShipping;
  },

  parse(
    from: string,
    subject: string,
    htmlBody: string,
    textBody: string
  ): ParsedShipmentData | null {
    const body = textBody || htmlBody.replace(/<[^>]*>/g, " ");
    const retailer = identifyRetailer(from) || "Israeli Store";

    let status: ParsedShipmentData["status"] = "ordered";
    const combined = subject + " " + body;
    if (/נמסר|delivered|הגעה/i.test(subject)) {
      status = "delivered";
    } else if (/ממתין לאיסוף|ready.*pickup|איסוף/i.test(combined)) {
      status = "ready_for_pickup";
    } else if (/יצא לחלוקה|out.*delivery|שליח/i.test(combined)) {
      status = "out_for_delivery";
    } else if (/נשלח|shipped|dispatched|משלוח/i.test(subject)) {
      status = "shipped";
    }

    // Extract order number — various formats
    const orderMatch = body.match(
      /(?:הזמנה|order|מספר הזמנה)[#:\s]*(\d{4,15})/i
    );
    const orderNumber = orderMatch?.[1];

    // Extract item name
    let itemName: string | undefined;
    const itemMatch = body.match(
      /(?:פריט|מוצר|product|item)[\s:]*(.{4,100})(?:\n|כמות|qty|₪)/i
    );
    if (itemMatch) {
      const cleaned = cleanText(itemMatch[1]);
      if (cleaned.length > 3) itemName = cleaned.substring(0, 200);
    }

    // Fallback to cleaned subject
    if (!itemName) {
      itemName = itemNameFromSubject(subject, retailer);
    }

    // Extract tracking
    const tracking = extractTrackingNumbers(body);
    const trackingNumber =
      tracking.standard[0]?.trackingNumber || tracking.israelPost[0];
    const carrier = tracking.israelPost.length > 0
      ? "Israel Post"
      : tracking.standard[0]?.courier?.name;

    // Extract images from HTML
    const imageUrls: string[] = [];
    const imgRegex = /src="(https?:\/\/[^"]+(?:\.jpg|\.png|\.webp)[^"]*)"/gi;
    let imgMatch;
    while ((imgMatch = imgRegex.exec(htmlBody)) !== null) {
      if (
        !imgMatch[1].includes("logo") &&
        !imgMatch[1].includes("icon") &&
        !imgMatch[1].includes("banner")
      ) {
        imageUrls.push(imgMatch[1]);
      }
    }

    if (!itemName && !orderNumber && !trackingNumber) {
      return null;
    }

    return {
      retailer,
      orderNumber,
      itemName: cleanText(itemName || `${retailer} Order ${orderNumber || ""}`),
      trackingNumber,
      carrier,
      imageUrls: imageUrls.slice(0, 5),
      originCountry: "IL",
      status,
    };
  },
};
