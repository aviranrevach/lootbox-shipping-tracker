import type { EmailParser, ParsedShipmentData } from "./types";
import { cleanText, itemNameFromSubject } from "./index";
import { extractTrackingNumbers } from "@/lib/tracking/extractor";

export const ebayParser: EmailParser = {
  name: "ebay",

  canParse(from: string): boolean {
    const fromLower = from.toLowerCase();
    return (
      fromLower.includes("ebay.com") || fromLower.includes("members.ebay.com")
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

    let status: ParsedShipmentData["status"] = "ordered";
    if (subjectLower.includes("shipped") || subjectLower.includes("on its way")) {
      status = "shipped";
    } else if (subjectLower.includes("delivered")) {
      status = "delivered";
    }

    // Extract item name from subject line
    let itemName: string | undefined;
    const itemMatch = subject.match(
      /(?:shipped|sent|delivery|item).*?[:-]\s*(.+)/i
    );
    if (itemMatch) {
      const cleaned = cleanText(itemMatch[1]);
      if (cleaned.length > 3) itemName = cleaned;
    }

    // Try to get item from body
    if (!itemName) {
      const bodyItem = body.match(
        /(?:Item|Product|You bought)[\s:]+(.{5,100})(?:\n|Item #)/i
      );
      if (bodyItem) {
        const cleaned = cleanText(bodyItem[1]);
        if (cleaned.length > 4) itemName = cleaned.substring(0, 200);
      }
    }

    // Fallback to cleaned subject
    if (!itemName) {
      itemName = itemNameFromSubject(subject, "eBay");
    }

    // Extract eBay order/item number
    const orderMatch = body.match(/(?:Item #|Order #|item number)[:\s]*(\d{10,14})/i);
    const orderNumber = orderMatch?.[1];

    // Extract tracking
    const tracking = extractTrackingNumbers(body);
    const trackingNumber =
      tracking.standard[0]?.trackingNumber || tracking.israelPost[0];
    const carrier = tracking.standard[0]?.courier?.name;

    // Extract product images
    const imageUrls: string[] = [];
    const imgRegex =
      /src="(https?:\/\/i\.ebayimg\.com\/[^"]+)"/gi;
    let imgMatch;
    while ((imgMatch = imgRegex.exec(htmlBody)) !== null) {
      imageUrls.push(imgMatch[1]);
    }

    if (!itemName && !orderNumber && !trackingNumber) {
      return null;
    }

    return {
      retailer: "eBay",
      orderNumber,
      itemName: cleanText(itemName || `eBay Item ${orderNumber || ""}`),
      trackingNumber,
      carrier,
      imageUrls: imageUrls.slice(0, 5),
      status,
    };
  },
};
