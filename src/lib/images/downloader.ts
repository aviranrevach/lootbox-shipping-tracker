import fs from "fs";
import path from "path";
import crypto from "crypto";

const IMAGES_DIR = "./data/images";

// Block promotional images (app store badges, buttons, logos)
const BLOCKED_URL_PATTERNS = [
  "google-play", "google_play", "googleplay",
  "app-store", "app_store", "appstore",
  "badge", "btn_", "button", "banner",
  "logo", "footer", "header", "icon",
  "apple.com/app-store",
];

function isBlockedImageUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return BLOCKED_URL_PATTERNS.some((p) => lower.includes(p));
}

export async function downloadImage(
  url: string,
  shipmentId: number
): Promise<string | null> {
  try {
    if (isBlockedImageUrl(url)) return null;

    const dir = path.join(IMAGES_DIR, String(shipmentId));
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") || "";
    const ext = getExtension(contentType, url);
    const hash = crypto.createHash("md5").update(url).digest("hex").slice(0, 8);
    const filename = `${hash}${ext}`;
    const filePath = path.join(dir, filename);

    const buffer = Buffer.from(await response.arrayBuffer());

    // Skip tiny images (likely tracking pixels)
    if (buffer.length < 1000) return null;

    fs.writeFileSync(filePath, buffer);
    return filePath;
  } catch (error) {
    console.error(`Failed to download image from ${url}:`, error);
    return null;
  }
}

function getExtension(contentType: string, url: string): string {
  if (contentType.includes("png")) return ".png";
  if (contentType.includes("webp")) return ".webp";
  if (contentType.includes("gif")) return ".gif";

  // Try from URL
  const urlExt = url.match(/\.(jpg|jpeg|png|webp|gif)/i);
  if (urlExt) return `.${urlExt[1].toLowerCase()}`;

  return ".jpg"; // default
}

export async function downloadImages(
  urls: string[],
  shipmentId: number
): Promise<string[]> {
  const paths: string[] = [];

  for (const url of urls.slice(0, 5)) {
    const filePath = await downloadImage(url, shipmentId);
    if (filePath) {
      paths.push(filePath);
    }
  }

  return paths;
}
