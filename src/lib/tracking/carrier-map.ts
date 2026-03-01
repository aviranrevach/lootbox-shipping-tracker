export interface CarrierInfo {
  name: string;
  trackingUrl: (trackingNumber: string) => string;
}

export const CARRIER_MAP: Record<string, CarrierInfo> = {
  usps: {
    name: "USPS",
    trackingUrl: (n) =>
      `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}`,
  },
  ups: {
    name: "UPS",
    trackingUrl: (n) => `https://www.ups.com/track?tracknum=${n}`,
  },
  fedex: {
    name: "FedEx",
    trackingUrl: (n) => `https://www.fedex.com/fedextrack/?trknbr=${n}`,
  },
  dhl: {
    name: "DHL",
    trackingUrl: (n) =>
      `https://www.dhl.com/en/express/tracking.html?AWB=${n}`,
  },
  "israel post": {
    name: "Israel Post",
    trackingUrl: (n) =>
      `https://israelpost.co.il/en/itemtrace?itemcode=${n}`,
  },
  "amazon logistics": {
    name: "Amazon Logistics",
    trackingUrl: (n) =>
      `https://www.amazon.com/progress-tracker/package/${n}`,
  },
  ontrac: {
    name: "OnTrac",
    trackingUrl: (n) =>
      `https://www.ontrac.com/tracking/?number=${n}`,
  },
  yanwen: {
    name: "Yanwen",
    trackingUrl: (n) =>
      `https://track.yw56.com.cn/en/querydel?nums=${n}`,
  },
  "cainiao": {
    name: "Cainiao",
    trackingUrl: (n) =>
      `https://global.cainiao.com/detail.htm?mailNoList=${n}`,
  },
  cheetah: {
    name: "Cheetah",
    trackingUrl: (n) =>
      `https://chitadelivery.co.il/en/?page_id=2794&tracking=${n}`,
  },
};

export function getCarrierInfo(
  carrierName: string | null | undefined
): CarrierInfo | null {
  if (!carrierName) return null;
  const key = carrierName.toLowerCase();
  return CARRIER_MAP[key] || null;
}

export function getTrackingUrl(
  carrierName: string | null | undefined,
  trackingNumber: string
): string | null {
  const info = getCarrierInfo(carrierName);
  return info ? info.trackingUrl(trackingNumber) : null;
}
