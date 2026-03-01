import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const SHIPMENT_STATUSES = [
  "ordered",
  "shipped",
  "in_transit",
  "customs_held",
  "out_for_delivery",
  "ready_for_pickup",
  "delivered",
  "picked_up",
  "returned",
  "stuck",
  "overdue",
  "cancelled",
  "lost",
] as const;

export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export const IMAGE_SOURCES = ["email", "website", "manual"] as const;
export type ImageSource = (typeof IMAGE_SOURCES)[number];

// ──────────────────────────────────────────────────
// Shipments — the central entity
// ──────────────────────────────────────────────────
export const shipments = sqliteTable("shipments", {
  id: integer("id").primaryKey({ autoIncrement: true }),

  // Retailer and order info
  retailer: text("retailer"),
  orderNumber: text("order_number"),
  itemName: text("item_name"),
  itemDescription: text("item_description"),
  purchaseDate: text("purchase_date"),

  // Status
  status: text("status", { enum: SHIPMENT_STATUSES })
    .notNull()
    .default("ordered"),

  // Tracking
  trackingNumber: text("tracking_number"),
  carrier: text("carrier"),
  trackingUrl: text("tracking_url"),

  // Dates
  estimatedDelivery: text("estimated_delivery"),
  actualDelivery: text("actual_delivery"),
  lastStatusUpdate: text("last_status_update"),

  // Origin
  originCountry: text("origin_country"),
  isInternational: integer("is_international", { mode: "boolean" }).default(
    false
  ),

  // Email linkage
  emailId: text("email_id"),
  emailSubject: text("email_subject"),
  emailFrom: text("email_from"),

  // Product
  productUrl: text("product_url"),

  // Flags
  isManual: integer("is_manual", { mode: "boolean" }).default(false),

  // Notes
  notes: text("notes"),

  // Source Gmail account
  accountEmail: text("account_email"),

  // Timestamps
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

// ──────────────────────────────────────────────────
// Shipment Images — multiple images per shipment
// ──────────────────────────────────────────────────
export const shipmentImages = sqliteTable("shipment_images", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  shipmentId: integer("shipment_id")
    .notNull()
    .references(() => shipments.id, { onDelete: "cascade" }),
  filePath: text("file_path").notNull(),
  sourceUrl: text("source_url"),
  source: text("source", { enum: IMAGE_SOURCES }).notNull().default("email"),
  isPrimary: integer("is_primary", { mode: "boolean" }).default(false),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

// ──────────────────────────────────────────────────
// Gmail Accounts — connected Gmail accounts
// ──────────────────────────────────────────────────
export const gmailAccounts = sqliteTable("gmail_accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  tokens: text("tokens").notNull(),
  addedAt: text("added_at").default(sql`(datetime('now'))`),
  lastSyncAt: text("last_sync_at"),
});

// ──────────────────────────────────────────────────
// Email Sync — tracks which emails have been processed
// ──────────────────────────────────────────────────
export const emailSync = sqliteTable("email_sync", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gmailMessageId: text("gmail_message_id").notNull().unique(),
  gmailThreadId: text("gmail_thread_id"),
  subject: text("subject"),
  fromAddress: text("from_address"),
  receivedAt: text("received_at"),
  processedAt: text("processed_at").default(sql`(datetime('now'))`),
  parserUsed: text("parser_used"),
  resultStatus: text("result_status", {
    enum: ["matched", "no_match", "error"],
  }).notNull(),
  errorMessage: text("error_message"),
  shipmentId: integer("shipment_id").references(() => shipments.id),
  accountEmail: text("account_email"),
});

// ──────────────────────────────────────────────────
// Settings — key-value user preferences
// ──────────────────────────────────────────────────
export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

// ──────────────────────────────────────────────────
// Sync Log — records of each sync run
// ──────────────────────────────────────────────────
export const syncLog = sqliteTable("sync_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  startedAt: text("started_at").default(sql`(datetime('now'))`),
  completedAt: text("completed_at"),
  emailsScanned: integer("emails_scanned").default(0),
  shipmentsCreated: integer("shipments_created").default(0),
  shipmentsUpdated: integer("shipments_updated").default(0),
  errors: integer("errors").default(0),
  status: text("status", {
    enum: ["running", "completed", "failed"],
  }).notNull(),
  errorMessage: text("error_message"),
});
