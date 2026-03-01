import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { buildSearchQuery } from "./queries";

export interface RawEmail {
  id: string;
  threadId: string;
  raw: string;
}

export async function fetchShippingEmails(
  auth: OAuth2Client,
  afterDate?: string,
  maxResults = 100
): Promise<RawEmail[]> {
  const gmail = google.gmail({ version: "v1", auth });
  const query = buildSearchQuery(afterDate);
  const emails: RawEmail[] = [];
  let pageToken: string | undefined;

  do {
    const res = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults: Math.min(maxResults - emails.length, 100),
      pageToken,
    });

    const messages = res.data.messages || [];

    for (const msg of messages) {
      if (!msg.id || emails.length >= maxResults) break;

      const full = await gmail.users.messages.get({
        userId: "me",
        id: msg.id,
        format: "raw",
      });

      if (full.data.raw && full.data.id) {
        emails.push({
          id: full.data.id,
          threadId: full.data.threadId || "",
          raw: full.data.raw,
        });
      }
    }

    pageToken = res.data.nextPageToken || undefined;
  } while (pageToken && emails.length < maxResults);

  return emails;
}

export async function getGmailProfile(auth: OAuth2Client) {
  const gmail = google.gmail({ version: "v1", auth });
  const profile = await gmail.users.getProfile({ userId: "me" });
  return profile.data;
}
