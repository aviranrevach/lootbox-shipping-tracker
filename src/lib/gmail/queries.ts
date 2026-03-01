// Gmail search queries for finding shipping-related emails

export const SHIPPING_QUERIES = [
  // Amazon
  'from:(ship-confirm@amazon.com OR auto-confirm@amazon.com OR shipment-tracking@amazon.com) subject:(shipped OR delivered OR "order confirmed" OR tracking)',
  'from:(*@amazon.co.il) subject:(shipped OR "order confirmed" OR tracking OR נשלח OR הזמנה)',

  // eBay
  'from:(ebay@ebay.com OR *@members.ebay.com) subject:(shipped OR "tracking number" OR delivered)',

  // AliExpress
  'from:(*@aliexpress.com OR *@mail.aliexpress.com) subject:(shipped OR "on the way" OR tracking OR delivered)',

  // Cheetah Delivery (Israeli courier)
  'from:(*@chita-il.com OR *@chitadelivery.co.il OR *@cheetahdelivery.co.il)',

  // Israeli retailers
  'from:(*@ksp.co.il OR *@ivory.co.il OR *@bug.co.il OR *@zap.co.il)',
  'subject:(משלוח OR הזמנה OR נשלח OR הגעה OR איסוף OR שליח OR "מעקב משלוח" OR "דואר ישראל")',

  // Generic shipping notifications
  'subject:("has shipped" OR "tracking number" OR "out for delivery" OR "your order has been shipped" OR "shipment confirmation")',
];

export function buildSearchQuery(afterDate?: string): string {
  const queryParts = SHIPPING_QUERIES.map((q) => `(${q})`);
  let query = queryParts.join(" OR ");

  if (afterDate) {
    query = `(${query}) after:${afterDate}`;
  }

  return query;
}
