import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { eq } from "drizzle-orm";
import { simpleParser } from "mailparser";
import { db } from "@/lib/db";
import { emailSync } from "@/lib/db/schema";
import {
  getAuthenticatedClientForAccount,
  getFirstAuthenticatedClient,
} from "@/lib/gmail/auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const { messageId } = await params;

    // Look up which account this email belongs to
    const syncRow = await db
      .select({ accountEmail: emailSync.accountEmail })
      .from(emailSync)
      .where(eq(emailSync.gmailMessageId, messageId))
      .get();

    let client;
    if (syncRow?.accountEmail) {
      client = await getAuthenticatedClientForAccount(syncRow.accountEmail);
    }
    // Fallback for legacy emails without accountEmail
    if (!client) {
      client = await getFirstAuthenticatedClient();
    }

    if (!client) {
      return NextResponse.json(
        { error: "Gmail not connected" },
        { status: 400 }
      );
    }

    const gmail = google.gmail({ version: "v1", auth: client });

    const res = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "raw",
    });

    if (!res.data.raw) {
      return NextResponse.json(
        { error: "Email not found" },
        { status: 404 }
      );
    }

    const rawBuffer = Buffer.from(res.data.raw, "base64url");
    const parsed = await simpleParser(rawBuffer);

    // Sanitize HTML: remove scripts and event handlers for safe rendering
    let html = typeof parsed.html === "string" ? parsed.html : "";
    html = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/\son\w+="[^"]*"/gi, "")
      .replace(/\son\w+='[^']*'/gi, "");

    // Replace cid: references with actual attachment data URIs so images render
    if (parsed.attachments && parsed.attachments.length > 0) {
      for (const att of parsed.attachments) {
        if (att.contentId && att.content) {
          const cid = att.contentId.replace(/[<>]/g, "");
          const dataUri = `data:${att.contentType};base64,${att.content.toString("base64")}`;
          html = html.replace(
            new RegExp(`cid:${cid.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "gi"),
            dataUri
          );
        }
      }
    }

    // Extract product images — prioritize known product image patterns
    const productImages: string[] = [];
    const otherImages: string[] = [];

    // 1. AliExpress product images: td[background] with product-image class
    const bgRegex =
      /background="(https?:\/\/[^"]+)"[^>]*class="[^"]*product-image[^"]*"/gi;
    let bgMatch;
    while ((bgMatch = bgRegex.exec(html)) !== null) {
      const url = bgMatch[1];
      if (!productImages.includes(url)) productImages.push(url);
    }

    // 2. Standard <img> tags
    const imgTagRegex = /<img[^>]+src="([^"]+)"[^>]*>/gi;
    let imgMatch;
    while ((imgMatch = imgTagRegex.exec(html)) !== null) {
      const url = imgMatch[1];
      if (!url.startsWith("http") && !url.startsWith("data:image")) continue;
      const lower = url.toLowerCase();
      if (
        lower.includes("spacer") ||
        lower.includes("pixel") ||
        lower.includes("transparent") ||
        lower.includes("1x1") ||
        lower.includes("beacon")
      ) continue;
      if (
        !productImages.includes(url) &&
        !otherImages.includes(url)
      ) {
        otherImages.push(url);
      }
    }

    // Product images first, then other images
    const imageUrls = [...productImages, ...otherImages];

    return NextResponse.json({
      subject: parsed.subject || "",
      from: parsed.from?.text || "",
      date: parsed.date?.toISOString() || "",
      html,
      text: parsed.text || "",
      images: imageUrls,
    });
  } catch (error) {
    console.error("Email fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch email" },
      { status: 500 }
    );
  }
}
