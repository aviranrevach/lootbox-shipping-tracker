import type { EmailParser, ParsedShipmentData } from "./types";
import { amazonParser } from "./amazon";
import { ebayParser } from "./ebay";
import { aliexpressParser } from "./aliexpress";
import { cheetahDeliveryParser } from "./cheetah-delivery";
import { israeliRetailersParser } from "./israeli-retailers";
import { genericParser } from "./generic";

// Ordered by priority — specific parsers first, generic last
const parsers: EmailParser[] = [
  amazonParser,
  ebayParser,
  aliexpressParser,
  cheetahDeliveryParser,
  israeliRetailersParser,
  genericParser,
];

export interface ParseResult {
  data: ParsedShipmentData | null;
  parserUsed: string;
}

export function parseEmail(
  from: string,
  subject: string,
  htmlBody: string,
  textBody: string
): ParseResult {
  for (const parser of parsers) {
    if (parser.canParse(from, subject)) {
      const data = parser.parse(from, subject, htmlBody, textBody);
      if (data) {
        return { data, parserUsed: parser.name };
      }
    }
  }

  return { data: null, parserUsed: "none" };
}

/** Clean HTML entities and zero-width chars from parsed text */
export function cleanText(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&zwnj;/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, "")
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract a meaningful item name from email subject */
export function itemNameFromSubject(subject: string, retailer: string, orderNumber?: string): string {
  // Remove common prefixes/suffixes
  let name = subject
    .replace(/^(re|fw|fwd):\s*/gi, "")
    .replace(/order\s*#?\s*[\d-]+:?\s*/gi, "")
    .replace(/\b(has shipped|shipped|delivered|dispatched|confirmed|on the way|out for delivery|partially shipped|order)\b/gi, "")
    .replace(/\byour\b/gi, "")
    .replace(/\bpackage\b/gi, "")
    .replace(/[-–—:]\s*$/g, "")
    .replace(/^\s*[-–—:]\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (name.length < 3) {
    name = orderNumber
      ? `${retailer} Order #${orderNumber}`
      : `${retailer} Order`;
  }

  return name.substring(0, 200);
}

export type { ParsedShipmentData, EmailParser };
