import type { EmailParser, ParsedShipmentData } from "./types";
import { cleanText, itemNameFromSubject } from "./index";
import { extractTrackingNumbers } from "@/lib/tracking/extractor";

export const aliexpressParser: EmailParser = {
  name: "aliexpress",

  canParse(from: string): boolean {
    return from.toLowerCase().includes("aliexpress.com");
  },

  parse(
    from: string,
    subject: string,
    htmlBody: string,
    textBody: string
  ): ParsedShipmentData | null {
    const body = textBody || htmlBody.replace(/<[^>]*>/g, " ");
    const subjectLower = subject.toLowerCase();

    let status: ParsedShipmentData["status"] = "ordered";
    if (
      subjectLower.includes("shipped") ||
      subjectLower.includes("on the way") ||
      subjectLower.includes("dispatched") ||
      subjectLower.includes("collected by the carrier") ||
      subjectLower.includes("in transit")
    ) {
      status = "shipped";
    } else if (subjectLower.includes("delivered")) {
      status = "delivered";
    }

    // Extract order number from subject first (most reliable)
    let orderNumber: string | undefined;
    const subjectOrderMatch = subject.match(/Order\s+(\d{10,20})/i);
    if (subjectOrderMatch) {
      orderNumber = subjectOrderMatch[1];
    }

    // Fallback: extract from body
    if (!orderNumber) {
      const bodyOrderMatch = body.match(
        /(?:order|Order)\s*(?:#|number|No\.?)?[:\s]*(\d{10,20})/i
      );
      orderNumber = bodyOrderMatch?.[1];
    }

    // Extract product names from email HTML
    const productNames = extractProductNames(htmlBody, body);
    let itemName: string | undefined;

    if (productNames.length > 0) {
      if (productNames.length === 1) {
        itemName = productNames[0];
      } else {
        // Join multiple products: "Item1, Item2 (+3 more)"
        const shown = productNames.slice(0, 2).join(", ");
        const remaining = productNames.length - 2;
        itemName = remaining > 0
          ? `${shown} (+${remaining} more)`
          : shown;
      }
    }

    // Fallback: use cleaned email subject with order number
    if (!itemName) {
      itemName = itemNameFromSubject(subject, "AliExpress", orderNumber);
    }

    // Extract tracking — AliExpress uses various formats
    const tracking = extractTrackingNumbers(body);
    let trackingNumber =
      tracking.standard[0]?.trackingNumber || tracking.israelPost[0];
    let carrier = tracking.standard[0]?.courier?.name;

    // AliExpress-specific tracking patterns (LP, YANWEN, etc.)
    if (!trackingNumber) {
      const aliTrack = body.match(
        /(?:tracking|Tracking)\s*(?:#|number|No\.?)[:\s]*([A-Z0-9]{10,25})/i
      );
      if (aliTrack) {
        trackingNumber = aliTrack[1];
      }
    }

    // Also try subject for tracking patterns like "Package ED003249581"
    if (!trackingNumber) {
      const subjectTrack = subject.match(/Package\s+([A-Z]{2}\d{9,12}[A-Z]{0,2})/i);
      if (subjectTrack) {
        trackingNumber = subjectTrack[1];
      }
    }

    // Extract product images — prioritize td[background] with product-image class
    const imageUrls: string[] = [];

    // Strategy 1: AliExpress v2 template uses td background= with product-image class
    const bgImgRegex =
      /background="(https?:\/\/[^"]+)"[^>]*class="[^"]*product-image[^"]*"/gi;
    let bgMatch;
    while ((bgMatch = bgImgRegex.exec(htmlBody)) !== null) {
      imageUrls.push(bgMatch[1]);
    }

    // Strategy 2: Fall back to <img src> from alicdn (filter junk)
    if (imageUrls.length === 0) {
      const imgRegex =
        /src="(https?:\/\/[^"]*(?:ae\d+\.alicdn|img\.alicdn)[^"]*(?:\.jpg|\.png|\.webp)[^"]*)"/gi;
      let imgMatch;
      while ((imgMatch = imgRegex.exec(htmlBody)) !== null) {
        const url = imgMatch[1];
        const urlLower = url.toLowerCase();
        const dimMatch = url.match(/(\d+)x(\d+)/);
        if (dimMatch) {
          const w = parseInt(dimMatch[1], 10);
          const h = parseInt(dimMatch[2], 10);
          if (w < 100 && h < 100) continue;
          if (w > 0 && h > 0 && w / h > 2) continue;
        }
        if (
          urlLower.includes("google-play") ||
          urlLower.includes("google_play") ||
          urlLower.includes("app-store") ||
          urlLower.includes("app_store") ||
          urlLower.includes("badge") ||
          urlLower.includes("btn_") ||
          urlLower.includes("button") ||
          urlLower.includes("banner") ||
          urlLower.includes("logo") ||
          urlLower.includes("footer") ||
          urlLower.includes("header") ||
          urlLower.includes("icon") ||
          urlLower.includes("apple.com")
        ) continue;
        imageUrls.push(url);
      }
    }

    if (!orderNumber && !trackingNumber) {
      return null;
    }

    return {
      retailer: "AliExpress",
      orderNumber,
      itemName: cleanText(itemName || `AliExpress Order #${orderNumber || ""}`),
      trackingNumber,
      carrier,
      imageUrls: imageUrls.slice(0, 5),
      originCountry: "CN",
      status,
    };
  },
};

/** Extract product names from AliExpress email HTML using multiple strategies */
function extractProductNames(html: string, textBody: string): string[] {
  const names: string[] = [];

  // Strategy 1: EDM-ORDER-LOGISTICS-product-name class (most reliable — present in some email templates)
  const edmRegex = /EDM-ORDER-LOGISTICS-product-name[^>]*>[\s\S]*?<span>([^<]+)<\/span>/gi;
  let match;
  while ((match = edmRegex.exec(html)) !== null) {
    const name = cleanText(match[1]);
    if (isValidProductName(name)) {
      names.push(name.substring(0, 120));
    }
  }

  if (names.length > 0) return dedup(names);

  // Strategy 2: Look for "Package details" section content
  const detailsSection = html.match(/Package\s+details[\s\S]*?(?=<\/table|<hr|$)/i);
  if (detailsSection) {
    const nameRegex = />([^<]{5,150})</g;
    let nameMatch;
    while ((nameMatch = nameRegex.exec(detailsSection[0])) !== null) {
      const name = cleanText(nameMatch[1]);
      if (isValidProductName(name)) {
        names.push(name.substring(0, 120));
      }
    }
  }

  if (names.length > 0) return dedup(names);

  // Strategy 3: Shipped: "Product Name..." pattern in subject (some email templates use this)
  // This is handled separately at the caller level via itemNameFromSubject

  return dedup(names);
}

// Marketing phrases and generic text from AliExpress emails to exclude
const EXCLUDED_PHRASES = [
  "fast delivery", "free returns", "free shipping",
  "download to get", "app-only deals", "see more items",
  "track your order", "track order", "track delivery",
  "order total", "order details", "see order details",
  "ship to", "prices, deals", "privacy policy", "terms of use",
  "unsubscribe", "aliexpress service", "alibaba.com",
  "your package", "timely arrival", "closely tracking",
  "has shipped", "has been collected", "has been delivered",
  "report spam", "looks safe",
];

function isValidProductName(name: string): boolean {
  if (name.length < 4) return false;
  const lower = name.toLowerCase();
  // Skip common non-product strings
  if (/^(view|click|track|more|details|see|x\d|qty|color|size|order|package|hi |dear |hello|your )/i.test(name)) return false;
  if (/^\d+$/.test(name)) return false;
  if (/^(AliExpress|aliexpress)$/i.test(name)) return false;
  // Skip marketing/generic phrases
  if (EXCLUDED_PHRASES.some((phrase) => lower.includes(phrase))) return false;
  // Skip if it looks like an email address or URL
  if (/@/.test(name) || /^https?:/.test(name) || /www\./.test(name)) return false;
  return true;
}

function dedup(names: string[]): string[] {
  const seen = new Set<string>();
  return names.filter((n) => {
    const key = n.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
