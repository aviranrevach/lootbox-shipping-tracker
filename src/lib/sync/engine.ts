import { simpleParser } from "mailparser";
import { eq, desc, and } from "drizzle-orm";
import type { OAuth2Client } from "google-auth-library";
import { db } from "@/lib/db";
import {
  shipments,
  shipmentImages,
  emailSync,
  syncLog,
  gmailAccounts,
} from "@/lib/db/schema";
import {
  getConnectedAccounts,
  getAuthenticatedClientForAccount,
} from "@/lib/gmail/auth";
import { fetchShippingEmails } from "@/lib/gmail/fetch";
import { parseEmail } from "@/lib/parsers";
import { getTrackingUrl } from "@/lib/tracking/carrier-map";
import { downloadImages } from "@/lib/images/downloader";
import { scrapeProductImage } from "@/lib/images/scraper";
import { updateOverdueStatuses } from "@/lib/shipments/overdue";

export async function syncEmails(): Promise<{
  emailsScanned: number;
  shipmentsCreated: number;
  shipmentsUpdated: number;
  errors: number;
}> {
  const accounts = await getConnectedAccounts();
  if (accounts.length === 0) {
    throw new Error("No Gmail accounts connected");
  }

  // Create sync log entry
  const [logEntry] = await db
    .insert(syncLog)
    .values({ status: "running" })
    .returning();

  let totalEmailsScanned = 0;
  let totalShipmentsCreated = 0;
  let totalShipmentsUpdated = 0;
  let totalErrors = 0;

  try {
    // Get last sync date
    const lastSync = await db
      .select()
      .from(syncLog)
      .where(eq(syncLog.status, "completed"))
      .orderBy(desc(syncLog.completedAt))
      .limit(1)
      .get();

    const afterDate = lastSync?.startedAt
      ? new Date(lastSync.startedAt)
          .toISOString()
          .split("T")[0]
          .replace(/-/g, "/")
      : undefined;

    // Sync each account sequentially
    for (const account of accounts) {
      try {
        console.log(`[Sync] Syncing account: ${account.email}`);
        const client = await getAuthenticatedClientForAccount(account.email);
        if (!client) {
          console.warn(
            `[Sync] Could not get client for ${account.email}, skipping`
          );
          totalErrors++;
          continue;
        }

        const result = await syncAccountEmails(
          client,
          account.email,
          afterDate
        );
        totalEmailsScanned += result.emailsScanned;
        totalShipmentsCreated += result.shipmentsCreated;
        totalShipmentsUpdated += result.shipmentsUpdated;
        totalErrors += result.errors;

        // Update lastSyncAt for this account
        await db
          .update(gmailAccounts)
          .set({ lastSyncAt: new Date().toISOString() })
          .where(eq(gmailAccounts.email, account.email));
      } catch (error) {
        console.error(
          `[Sync] Error syncing account ${account.email}:`,
          error
        );
        totalErrors++;
      }
    }

    // Run overdue detection once after all accounts
    await updateOverdueStatuses();

    // Update sync log
    await db
      .update(syncLog)
      .set({
        status: "completed",
        completedAt: new Date().toISOString(),
        emailsScanned: totalEmailsScanned,
        shipmentsCreated: totalShipmentsCreated,
        shipmentsUpdated: totalShipmentsUpdated,
        errors: totalErrors,
      })
      .where(eq(syncLog.id, logEntry.id));
  } catch (error) {
    await db
      .update(syncLog)
      .set({
        status: "failed",
        completedAt: new Date().toISOString(),
        emailsScanned: totalEmailsScanned,
        shipmentsCreated: totalShipmentsCreated,
        shipmentsUpdated: totalShipmentsUpdated,
        errors: totalErrors,
        errorMessage:
          error instanceof Error ? error.message : "Unknown error",
      })
      .where(eq(syncLog.id, logEntry.id));

    throw error;
  }

  return {
    emailsScanned: totalEmailsScanned,
    shipmentsCreated: totalShipmentsCreated,
    shipmentsUpdated: totalShipmentsUpdated,
    errors: totalErrors,
  };
}

async function syncAccountEmails(
  client: OAuth2Client,
  accountEmail: string,
  afterDate?: string
): Promise<{
  emailsScanned: number;
  shipmentsCreated: number;
  shipmentsUpdated: number;
  errors: number;
}> {
  let emailsScanned = 0;
  let shipmentsCreated = 0;
  let shipmentsUpdated = 0;
  let errors = 0;

  const emails = await fetchShippingEmails(client, afterDate);
  emailsScanned = emails.length;

  for (const email of emails) {
    try {
      // Check if already processed
      const existing = await db
        .select()
        .from(emailSync)
        .where(eq(emailSync.gmailMessageId, email.id))
        .get();

      if (existing) continue;

      // Parse raw email
      const rawBuffer = Buffer.from(email.raw, "base64url");
      const parsed = await simpleParser(rawBuffer);

      const from =
        parsed.from?.text || parsed.from?.value?.[0]?.address || "";
      const subject = parsed.subject || "";
      const htmlBody = typeof parsed.html === "string" ? parsed.html : "";
      const textBody = parsed.text || "";

      // Run through parser chain
      const { data, parserUsed } = parseEmail(
        from,
        subject,
        htmlBody,
        textBody
      );

      if (!data) {
        await db.insert(emailSync).values({
          gmailMessageId: email.id,
          gmailThreadId: email.threadId,
          subject,
          fromAddress: from,
          receivedAt: parsed.date?.toISOString(),
          parserUsed,
          resultStatus: "no_match",
          accountEmail,
        });
        continue;
      }

      // Try to match existing shipment
      const existingShipment = await findExistingShipment(data);

      let shipmentId: number;

      if (existingShipment) {
        await db
          .update(shipments)
          .set({
            status: shouldUpdateStatus(existingShipment.status, data.status)
              ? data.status
              : existingShipment.status,
            trackingNumber:
              data.trackingNumber || existingShipment.trackingNumber,
            carrier: data.carrier || existingShipment.carrier,
            trackingUrl:
              (data.trackingNumber && data.carrier
                ? getTrackingUrl(data.carrier, data.trackingNumber)
                : null) ||
              data.trackingUrl ||
              existingShipment.trackingUrl,
            estimatedDelivery:
              data.estimatedDelivery || existingShipment.estimatedDelivery,
            lastStatusUpdate: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            accountEmail: existingShipment.accountEmail || accountEmail,
          })
          .where(eq(shipments.id, existingShipment.id));

        shipmentId = existingShipment.id;
        shipmentsUpdated++;
      } else {
        const trackingUrl =
          (data.trackingNumber && data.carrier
            ? getTrackingUrl(data.carrier, data.trackingNumber)
            : null) ||
          data.trackingUrl ||
          null;

        const [newShipment] = await db
          .insert(shipments)
          .values({
            retailer: data.retailer,
            orderNumber: data.orderNumber,
            itemName: data.itemName,
            itemDescription: data.itemDescription,
            purchaseDate:
              data.purchaseDate || parsed.date?.toISOString().split("T")[0],
            status: data.status,
            trackingNumber: data.trackingNumber,
            carrier: data.carrier,
            trackingUrl,
            estimatedDelivery: data.estimatedDelivery,
            originCountry: data.originCountry,
            isInternational:
              !!data.originCountry && data.originCountry !== "IL",
            emailId: email.id,
            emailSubject: subject,
            emailFrom: from,
            productUrl: data.productUrl,
            lastStatusUpdate: new Date().toISOString(),
            accountEmail,
          })
          .returning();

        shipmentId = newShipment.id;
        shipmentsCreated++;
      }

      // Download images if available
      if (data.imageUrls && data.imageUrls.length > 0) {
        const existingImages = await db
          .select()
          .from(shipmentImages)
          .where(eq(shipmentImages.shipmentId, shipmentId));

        if (existingImages.length === 0) {
          const paths = await downloadImages(data.imageUrls, shipmentId);
          for (let i = 0; i < paths.length; i++) {
            await db.insert(shipmentImages).values({
              shipmentId,
              filePath: paths[i],
              sourceUrl: data.imageUrls[i],
              source: "email",
              isPrimary: i === 0,
            });
          }
        }
      }

      // Try scraping product image if no email images and product URL exists
      if (data.productUrl) {
        const hasImages = await db
          .select()
          .from(shipmentImages)
          .where(eq(shipmentImages.shipmentId, shipmentId))
          .get();

        if (!hasImages) {
          try {
            const scrapedPath = await scrapeProductImage(
              data.productUrl,
              shipmentId
            );
            if (scrapedPath) {
              await db.insert(shipmentImages).values({
                shipmentId,
                filePath: scrapedPath,
                sourceUrl: data.productUrl,
                source: "website",
                isPrimary: true,
              });
            }
          } catch {
            // Non-critical — continue without image
          }
        }
      }

      // Record processed email
      await db.insert(emailSync).values({
        gmailMessageId: email.id,
        gmailThreadId: email.threadId,
        subject,
        fromAddress: from,
        receivedAt: parsed.date?.toISOString(),
        parserUsed,
        resultStatus: "matched",
        shipmentId,
        accountEmail,
      });
    } catch (error) {
      console.error(`Error processing email ${email.id}:`, error);
      errors++;

      await db.insert(emailSync).values({
        gmailMessageId: email.id,
        gmailThreadId: email.threadId,
        parserUsed: "error",
        resultStatus: "error",
        errorMessage:
          error instanceof Error ? error.message : "Unknown error",
        accountEmail,
      });
    }
  }

  return { emailsScanned, shipmentsCreated, shipmentsUpdated, errors };
}

async function findExistingShipment(data: {
  trackingNumber?: string;
  orderNumber?: string;
  retailer: string;
  itemName?: string;
}) {
  if (data.trackingNumber) {
    const match = await db
      .select()
      .from(shipments)
      .where(eq(shipments.trackingNumber, data.trackingNumber))
      .get();
    if (match) return match;
  }

  if (data.orderNumber) {
    const match = await db
      .select()
      .from(shipments)
      .where(
        and(
          eq(shipments.orderNumber, data.orderNumber),
          eq(shipments.retailer, data.retailer)
        )
      )
      .get();
    if (match) return match;
  }

  return null;
}

const STATUS_ORDER = [
  "ordered",
  "shipped",
  "in_transit",
  "customs_held",
  "out_for_delivery",
  "ready_for_pickup",
  "delivered",
  "picked_up",
] as const;

function shouldUpdateStatus(
  currentStatus: string,
  newStatus: string
): boolean {
  const currentIndex = STATUS_ORDER.indexOf(
    currentStatus as (typeof STATUS_ORDER)[number]
  );
  const newIndex = STATUS_ORDER.indexOf(
    newStatus as (typeof STATUS_ORDER)[number]
  );

  if (currentIndex === -1 || newIndex === -1) return true;
  return newIndex > currentIndex;
}
