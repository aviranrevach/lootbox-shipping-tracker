import { downloadImage } from "./downloader";

const PRODUCT_IMAGE_SELECTORS: Record<string, RegExp[]> = {
  amazon: [
    /data-old-hires="([^"]+)"/,
    /id="landingImage"[^>]*src="([^"]+)"/,
    /id="imgBlkFront"[^>]*src="([^"]+)"/,
    /"hiRes":"([^"]+)"/,
    /"large":"([^"]+)"/,
  ],
  ebay: [
    /data-zoom-src="([^"]+)"/,
    /class="ux-image-magnify[^"]*"[^>]*src="([^"]+)"/,
    /"image":\s*"([^"]+)"/,
  ],
  aliexpress: [
    /class="magnifier-image"[^>]*src="([^"]+)"/,
    /"imageUrl":"([^"]+)"/,
    /data-role="thumb"[^>]*src="([^"]+)"/,
  ],
  ksp: [/class="tImageBig"[^>]*src="([^"]+)"/, /"mainImage":"([^"]+)"/],
  ivory: [/class="product-image[^"]*"[^>]*src="([^"]+)"/],
  bug: [/class="gallery-image[^"]*"[^>]*src="([^"]+)"/],
};

function detectRetailer(url: string): string | null {
  if (url.includes("amazon.")) return "amazon";
  if (url.includes("ebay.")) return "ebay";
  if (url.includes("aliexpress.")) return "aliexpress";
  if (url.includes("ksp.co.il")) return "ksp";
  if (url.includes("ivory.co.il")) return "ivory";
  if (url.includes("bug.co.il")) return "bug";
  return null;
}

export async function scrapeProductImage(
  productUrl: string,
  shipmentId: number
): Promise<string | null> {
  try {
    const response = await fetch(productUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return null;

    const html = await response.text();
    const retailer = detectRetailer(productUrl);

    let imageUrl: string | null = null;

    if (retailer && PRODUCT_IMAGE_SELECTORS[retailer]) {
      for (const regex of PRODUCT_IMAGE_SELECTORS[retailer]) {
        const match = html.match(regex);
        if (match?.[1]) {
          imageUrl = match[1];
          break;
        }
      }
    }

    // Fallback: look for Open Graph image
    if (!imageUrl) {
      const ogMatch = html.match(
        /property="og:image"[^>]*content="([^"]+)"/
      );
      if (ogMatch?.[1]) {
        imageUrl = ogMatch[1];
      }
    }

    // Fallback: meta twitter:image
    if (!imageUrl) {
      const twitterMatch = html.match(
        /name="twitter:image"[^>]*content="([^"]+)"/
      );
      if (twitterMatch?.[1]) {
        imageUrl = twitterMatch[1];
      }
    }

    if (!imageUrl) return null;

    // Resolve relative URLs
    if (imageUrl.startsWith("//")) {
      imageUrl = "https:" + imageUrl;
    } else if (imageUrl.startsWith("/")) {
      const urlObj = new URL(productUrl);
      imageUrl = urlObj.origin + imageUrl;
    }

    const filePath = await downloadImage(imageUrl, shipmentId);
    return filePath;
  } catch {
    return null;
  }
}
