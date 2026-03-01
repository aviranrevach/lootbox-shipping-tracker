import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { gmailAccounts } from "@/lib/db/schema";
import { createOAuth2Client } from "./client";
import type { Credentials } from "google-auth-library";

export async function storeAccountTokens(
  email: string,
  tokens: Credentials
): Promise<void> {
  const value = JSON.stringify(tokens);
  const existing = await db
    .select()
    .from(gmailAccounts)
    .where(eq(gmailAccounts.email, email))
    .get();

  if (existing) {
    await db
      .update(gmailAccounts)
      .set({ tokens: value })
      .where(eq(gmailAccounts.email, email));
  } else {
    await db.insert(gmailAccounts).values({ email, tokens: value });
  }
}

export async function loadAccountTokens(
  email: string
): Promise<Credentials | null> {
  const row = await db
    .select()
    .from(gmailAccounts)
    .where(eq(gmailAccounts.email, email))
    .get();

  if (!row) return null;

  try {
    return JSON.parse(row.tokens) as Credentials;
  } catch {
    return null;
  }
}

export async function removeAccount(email: string): Promise<void> {
  await db.delete(gmailAccounts).where(eq(gmailAccounts.email, email));
}

export async function getConnectedAccounts(): Promise<
  Array<{
    id: number;
    email: string;
    addedAt: string | null;
    lastSyncAt: string | null;
  }>
> {
  return db
    .select({
      id: gmailAccounts.id,
      email: gmailAccounts.email,
      addedAt: gmailAccounts.addedAt,
      lastSyncAt: gmailAccounts.lastSyncAt,
    })
    .from(gmailAccounts);
}

export async function getAuthenticatedClientForAccount(email: string) {
  const tokens = await loadAccountTokens(email);
  if (!tokens) return null;

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials(tokens);

  oauth2Client.on("tokens", async (newTokens) => {
    const current = await loadAccountTokens(email);
    await storeAccountTokens(email, { ...current, ...newTokens });
  });

  return oauth2Client;
}

export async function getFirstAuthenticatedClient() {
  const accounts = await getConnectedAccounts();
  if (accounts.length === 0) return null;
  return getAuthenticatedClientForAccount(accounts[0].email);
}

export async function isGmailConnected(): Promise<boolean> {
  const accounts = await getConnectedAccounts();
  return accounts.length > 0;
}
