// Extract product images from email HTML content

export interface ExtractedImage {
  url: string;
  alt?: string;
}

export function extractImagesFromHtml(html: string): ExtractedImage[] {
  const images: ExtractedImage[] = [];
  const imgRegex = /<img[^>]+src="(https?:\/\/[^"]+)"[^>]*(?:alt="([^"]*)")?[^>]*>/gi;
  let match;

  while ((match = imgRegex.exec(html)) !== null) {
    const url = match[1];
    const alt = match[2];

    // Filter out common non-product images
    if (shouldSkipImage(url)) continue;

    images.push({ url, alt });
  }

  // Also check for data-src attributes (lazy-loaded images)
  const dataSrcRegex = /<img[^>]+data-src="(https?:\/\/[^"]+)"[^>]*(?:alt="([^"]*)")?[^>]*>/gi;
  while ((match = dataSrcRegex.exec(html)) !== null) {
    const url = match[1];
    const alt = match[2];
    if (shouldSkipImage(url)) continue;
    images.push({ url, alt });
  }

  return deduplicateImages(images);
}

function shouldSkipImage(url: string): boolean {
  const skipPatterns = [
    /transparent/i,
    /spacer/i,
    /pixel/i,
    /tracking/i,
    /beacon/i,
    /logo/i,
    /icon/i,
    /badge/i,
    /banner/i,
    /header/i,
    /footer/i,
    /social/i,
    /facebook/i,
    /twitter/i,
    /instagram/i,
    /email-open/i,
    /1x1/,
    /\.gif$/i,
    /gravatar/i,
    /avatar/i,
  ];

  return skipPatterns.some((p) => p.test(url));
}

function deduplicateImages(images: ExtractedImage[]): ExtractedImage[] {
  const seen = new Set<string>();
  return images.filter((img) => {
    // Normalize URL for comparison
    const normalized = img.url.split("?")[0];
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}
