import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { settings, gmailAccounts } from "@/lib/db/schema";
import { createOAuth2Client } from "@/lib/gmail/client";
import { getGmailProfile } from "@/lib/gmail/fetch";

/**
 * Fast schema migration — safe to await at startup.
 * Creates tables/columns without any external API calls.
 */
export async function migrateGmailAccountsSchema(): Promise<void> {
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS gmail_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      tokens TEXT NOT NULL,
      added_at TEXT DEFAULT (datetime('now')),
      last_sync_at TEXT
    )
  `);

  try {
    await db.run(sql`ALTER TABLE email_sync ADD COLUMN account_email TEXT`);
  } catch {
    // Column already exists — ignore
  }

  try {
    await db.run(sql`ALTER TABLE shipments ADD COLUMN account_email TEXT`);
  } catch {
    // Column already exists — ignore
  }
}

/**
 * Migrates legacy gmail_tokens from settings into the new gmail_accounts table.
 * Makes an external API call to discover the email — run in background, not blocking startup.
 */
export async function migrateLegacyTokens(): Promise<void> {
  try {
    // Check if migration already ran
    const existingAccount = await db
      .select()
      .from(gmailAccounts)
      .limit(1)
      .get();
    if (existingAccount) return;

    // Check for legacy tokens in settings table
    const legacyRow = await db
      .select()
      .from(settings)
      .where(eq(settings.key, "gmail_tokens"))
      .get();

    if (!legacyRow) return;

    const tokens = JSON.parse(legacyRow.value);

    // Discover the email for these tokens
    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials(tokens);
    const profile = await getGmailProfile(oauth2Client);
    const email = profile.emailAddress;

    if (email) {
      await db.insert(gmailAccounts).values({
        email,
        tokens: legacyRow.value,
      });
      console.log(`[Migration] Migrated Gmail account: ${email}`);
    }

    // Remove legacy row
    await db.delete(settings).where(eq(settings.key, "gmail_tokens"));
    console.log("[Migration] Removed legacy gmail_tokens from settings");
  } catch (error) {
    console.error("[Migration] Failed to migrate Gmail tokens:", error);
  }
}
