import type { ShipmentStatus } from "@/lib/db/schema";

export interface ParsedShipmentData {
  retailer: string;
  orderNumber?: string;
  itemName?: string;
  itemDescription?: string;
  trackingNumber?: string;
  carrier?: string;
  estimatedDelivery?: string;
  purchaseDate?: string;
  originCountry?: string;
  productUrl?: string;
  trackingUrl?: string;
  imageUrls?: string[];
  status: ShipmentStatus;
}

export interface EmailParser {
  name: string;
  canParse(from: string, subject: string): boolean;
  parse(
    from: string,
    subject: string,
    htmlBody: string,
    textBody: string
  ): ParsedShipmentData | null;
}
