import type { EmailParser, ParsedShipmentData } from "./types";
import { cleanText } from "./index";
import { extractTrackingNumbers } from "@/lib/tracking/extractor";

export const genericParser: EmailParser = {
  name: "generic",

  canParse(): boolean {
    return true; // Fallback parser, always tries
  },

  parse(
    from: string,
    subject: string,
    htmlBody: string,
    textBody: string
  ): ParsedShipmentData | null {
    const body = textBody || htmlBody.replace(/<[^>]*>/g, " ");

    // Try extracting tracking from body first
    const tracking = extractTrackingNumbers(body);
    let trackingNumber =
      tracking.standard[0]?.trackingNumber || tracking.israelPost[0];
    let carrier = tracking.israelPost.length > 0
      ? "Israel Post"
      : tracking.standard[0]?.courier?.name;

    // Also try extracting tracking from subject (e.g., "Package ED003249581 has been delivered")
    if (!trackingNumber) {
      const subjectTracking = extractTrackingNumbers(subject);
      trackingNumber =
        subjectTracking.standard[0]?.trackingNumber || subjectTracking.israelPost[0];
      if (trackingNumber) {
        carrier = subjectTracking.israelPost.length > 0
          ? "Israel Post"
          : subjectTracking.standard[0]?.courier?.name;
      }

      // Fallback: match tracking-like patterns in subject
      if (!trackingNumber) {
        const subjectTrackMatch = subject.match(/\b([A-Z]{2}\d{9,12}[A-Z]{0,2})\b/);
        if (subjectTrackMatch) {
          trackingNumber = subjectTrackMatch[1];
        }
      }
    }

    if (!trackingNumber) return null;

    // Determine status from subject
    let status: ParsedShipmentData["status"] = "shipped";
    const subjectLower = subject.toLowerCase();
    if (subjectLower.includes("delivered")) {
      status = "delivered";
    } else if (subjectLower.includes("out for delivery")) {
      status = "out_for_delivery";
    } else if (subjectLower.includes("in transit") || subjectLower.includes("on the way")) {
      status = "in_transit";
    } else if (
      subjectLower.includes("order confirmed") ||
      subjectLower.includes("order received")
    ) {
      status = "ordered";
    }

    // Extract retailer from sender domain
    const domainMatch = from.match(/@([^>]+)/);
    const retailer = domainMatch
      ? domainMatch[1].replace(/^mail\.|^noreply\./, "").split(".")[0]
      : "Unknown";

    // Use subject as item name (cleaned)
    let itemName = cleanText(
      subject
        .replace(
          /(?:tracking|shipped|has been delivered|delivered|order|your|update|confirmation|number|#\d+|package)/gi,
          ""
        )
        .replace(/[A-Z]{2}\d{9,12}[A-Z]{0,2}/g, "") // remove tracking numbers from name
        .trim()
    ).substring(0, 200);

    if (!itemName || itemName.length < 3) {
      itemName = `Package from ${retailer.charAt(0).toUpperCase() + retailer.slice(1)}`;
    }

    return {
      retailer: retailer.charAt(0).toUpperCase() + retailer.slice(1),
      itemName,
      trackingNumber,
      carrier,
      status,
    };
  },
};
