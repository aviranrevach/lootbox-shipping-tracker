import { findTracking } from "ts-tracking-number";

export interface TrackingResult {
  standard: ReturnType<typeof findTracking>;
  israelPost: string[];
  cheetah: string[];
}

export function extractTrackingNumbers(text: string): TrackingResult {
  // ts-tracking-number handles USPS, UPS, FedEx, DHL, OnTrac, Amazon Logistics, S10 international
  const standard = findTracking(text);

  // Israel Post patterns not covered by ts-tracking-number
  const israelPostPattern = /\b[A-Z]{2}\d{9}IL\b/g;
  const israelPostMatches = text.match(israelPostPattern) || [];

  // Cheetah / international S10-like without country suffix (e.g., AE039387007)
  const cheetahPattern = /\b[A-Z]{2}\d{7,9}\b/g;
  const cheetahRaw = text.match(cheetahPattern) || [];
  // Filter out Israel Post matches and common false positives
  const cheetahFiltered = cheetahRaw.filter(
    (m) => !m.endsWith("IL") && !/^(RE|FW|CC|TO|ID)\d/i.test(m)
  );

  // Deduplicate
  const israelPost = [...new Set(israelPostMatches)];
  const cheetah = [...new Set(cheetahFiltered)];

  return { standard, israelPost, cheetah };
}
