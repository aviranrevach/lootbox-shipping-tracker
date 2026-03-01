# Shipping Tracker - Implementation Plan

## Context

Build a local-first SaaS web app that scans Gmail for shipping/order emails, extracts tracking info, and displays a dashboard to monitor all shipments. The app should detect overdue/stuck items and help plan around ETAs. Supports Amazon, eBay, AliExpress, and Israeli retailers. Runs locally now, cloud-deployable later.

**Project directory**: Empty — starting from scratch.

---

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | Next.js 15 (App Router, TypeScript) | Easy local dev + cloud deploy later |
| UI | Tailwind CSS + shadcn/ui | Lightweight, customizable, great DX |
| Database | SQLite via better-sqlite3 + Drizzle ORM | Perfect for local-first, WAL mode for perf |
| Email | googleapis + google-auth-library | Official Gmail API with OAuth2 |
| Parsing | mailparser + ts-tracking-number | MIME parsing + tracking number extraction |
| Background | node-cron via Next.js instrumentation hook | Periodic email scanning |
| Validation | zod | Schema validation for API + forms |
| Dates | date-fns | Lightweight date utilities |
| Images | sharp (optional) | Resize/optimize downloaded product images |

---

## Database Schema (6 tables)

### `shipments` — core entity
- id, retailer, orderNumber, itemName, itemDescription, purchaseDate
- status (see full list below)
- trackingNumber, carrier, trackingUrl
- estimatedDelivery, actualDelivery, lastStatusUpdate
- originCountry, isInternational
- emailId, emailSubject, emailFrom
- productUrl (link to product page on retailer site)
- isManual, notes, createdAt, updatedAt

### `shipment_images` — multiple images per shipment
- id, shipmentId (FK), filePath (local path in `data/images/`)
- sourceUrl (original URL where image was found)
- source: `email | website | manual` (how the image was obtained)
- isPrimary (boolean — main display image)
- createdAt

### `email_sync` — tracks processed emails (dedup)
- gmailMessageId (unique), gmailThreadId, subject, from, receivedAt
- processedAt, parserUsed, resultStatus: `matched | no_match | error`
- shipmentId (FK)

### `settings` — key-value user preferences
- key (unique), value, updatedAt

### `sync_log` — audit trail of sync runs
- startedAt, completedAt, emailsScanned, shipmentsCreated, shipmentsUpdated
- errors, status: `running | completed | failed`

### Shipment Statuses (full list)
| Status | Description | Color |
|--------|-------------|-------|
| `ordered` | Order placed, not yet shipped | Blue |
| `shipped` | Left the retailer/warehouse | Indigo |
| `in_transit` | Moving through carrier network | Yellow |
| `customs_held` | Held at customs (international) | Orange |
| `out_for_delivery` | On the delivery vehicle | Amber |
| `ready_for_pickup` | At pickup point, waiting for you | Purple |
| `delivered` | Arrived at destination | Green |
| `picked_up` | You physically collected the item | Emerald |
| `returned` | Sent back to retailer | Gray |
| `stuck` | No status update for 7+ days | Red |
| `overdue` | Past expected delivery window | Dark Red |
| `cancelled` | Order was cancelled | Slate |
| `lost` | Declared lost by carrier | Dark Gray |

### Image Storage
- Images stored locally at `data/images/{shipmentId}/{filename}`
- Sources:
  1. **Email extraction**: Parse `<img>` tags from order confirmation emails (product thumbnails)
  2. **Product page scrape**: Follow product URLs in emails to fetch higher-res images
  3. **Manual upload**: User can upload/paste images when creating or editing a shipment
- Served via Next.js API route: `/api/images/[shipmentId]/[filename]`

---

## File Structure

```
src/
├── app/
│   ├── layout.tsx                  # Root layout + header nav
│   ├── page.tsx                    # Main dashboard (server component)
│   ├── globals.css
│   ├── shipments/[id]/page.tsx     # Shipment detail page
│   ├── settings/page.tsx           # Gmail connection + preferences
│   └── api/
│       ├── auth/login/route.ts     # Start OAuth2 flow
│       ├── auth/callback/route.ts  # OAuth2 callback, store tokens
│       ├── auth/status/route.ts    # Check if Gmail connected
│       ├── shipments/route.ts      # GET (list+filter), POST (manual)
│       ├── shipments/[id]/route.ts # GET, PATCH, DELETE single
│       ├── shipments/[id]/images/route.ts  # POST upload image
│       ├── images/[...path]/route.ts       # GET serve local images
│       ├── sync/route.ts           # POST trigger manual sync
│       └── settings/route.ts       # GET/PUT preferences
├── components/
│   ├── ui/                         # shadcn/ui components
│   ├── layout/
│   │   ├── header.tsx
│   │   └── providers.tsx
│   ├── dashboard/
│   │   ├── status-cards.tsx        # Status overview cards
│   │   ├── shipment-list.tsx       # Main table/list
│   │   ├── shipment-row.tsx        # Single row
│   │   ├── shipment-filters.tsx    # Status/carrier/date filters
│   │   ├── search-bar.tsx          # Debounced search
│   │   └── quick-filters.tsx       # Overdue/arriving soon/etc.
│   └── shipment/
│       ├── shipment-detail.tsx     # Full detail view
│       ├── shipment-timeline.tsx   # Visual status timeline
│       ├── shipment-form.tsx       # Manual entry/edit form
│       └── status-badge.tsx        # Color-coded status badge
├── lib/
│   ├── db/
│   │   ├── index.ts                # DB connection singleton (WAL mode)
│   │   └── schema.ts              # Drizzle schema definitions
│   ├── gmail/
│   │   ├── client.ts              # OAuth2 client factory
│   │   ├── auth.ts                # Token store/refresh in SQLite
│   │   ├── fetch.ts               # Email fetching with search queries
│   │   └── queries.ts             # Gmail search query builders
│   ├── parsers/
│   │   ├── index.ts               # Parser orchestrator (chain of responsibility)
│   │   ├── types.ts               # ParsedShipmentData interface
│   │   ├── amazon.ts              # Amazon email parser
│   │   ├── ebay.ts                # eBay email parser
│   │   ├── aliexpress.ts          # AliExpress email parser
│   │   ├── israeli-retailers.ts   # KSP, Ivory, Bug, Israel Post
│   │   └── generic.ts            # Fallback: extract any tracking number
│   ├── tracking/
│   │   ├── extractor.ts           # ts-tracking-number + Israel Post patterns
│   │   └── carrier-map.ts         # Carrier names + tracking URLs
│   ├── images/
│   │   ├── extractor.ts           # Extract product images from email HTML
│   │   ├── downloader.ts          # Download and save images locally
│   │   └── scraper.ts             # Fetch product image from retailer URL
│   ├── sync/
│   │   ├── engine.ts              # Main sync orchestrator
│   │   ├── cron.ts                # node-cron setup (every 30 min)
│   │   └── processor.ts           # Email-to-shipment pipeline
│   └── shipments/
│       ├── queries.ts             # DB query functions
│       ├── status.ts              # Status calculation
│       └── overdue.ts             # Overdue/stuck detection logic
├── hooks/
│   ├── use-shipments.ts           # Data fetching hook
│   ├── use-sync-status.ts         # Sync status polling
│   └── use-filters.ts            # Filter state management
├── types/
│   └── shipment.ts                # Shared TypeScript types
├── instrumentation.ts              # Next.js hook to start cron
drizzle.config.ts
.env.local
```

---

## Implementation Phases (ordered)

### Phase 1: Project Setup
1. `npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*"`
2. Install deps: `better-sqlite3 drizzle-orm googleapis google-auth-library mailparser ts-tracking-number node-cron date-fns zod` + dev deps
3. `npx shadcn@latest init` then add: button, card, badge, input, table, dialog, tabs, select, dropdown-menu, separator, skeleton, toast, sheet, popover, calendar
4. Configure `next.config.ts`: add `serverExternalPackages: ["better-sqlite3"]` and `instrumentationHook: true`
5. Create `.env.local` with placeholders for Google OAuth credentials + DB path
6. Create `drizzle.config.ts`

### Phase 2: Database
7. Write Drizzle schema (`src/lib/db/schema.ts`) — all 6 tables (shipments, shipment_images, email_sync, settings, sync_log, + status enum)
8. Write DB connection singleton (`src/lib/db/index.ts`) — WAL mode, auto-create data dir
9. Run `npx drizzle-kit push` to create the SQLite database

### Phase 3: Gmail OAuth
10. Write OAuth2 client factory (`src/lib/gmail/client.ts`)
11. Write token management (`src/lib/gmail/auth.ts`) — store/load/refresh from settings table
12. Write API routes: `/api/auth/login`, `/api/auth/callback`, `/api/auth/status`
13. Build settings page with Gmail connect/disconnect UI

### Phase 4: Email Parsing Pipeline
14. Write Gmail fetch service (`src/lib/gmail/fetch.ts`) — search queries for shipping emails
15. Write tracking extractor (`src/lib/tracking/extractor.ts`) — ts-tracking-number + Israel Post regex
16. Write carrier map (`src/lib/tracking/carrier-map.ts`) — USPS, UPS, FedEx, DHL, Israel Post tracking URLs
17. Write parser interface and orchestrator (`src/lib/parsers/types.ts`, `src/lib/parsers/index.ts`)
18. Write Amazon parser — order confirmations + shipping updates
19. Write eBay parser
20. Write AliExpress parser
21. Write Israeli retailers parser (KSP, Ivory, Israel Post)
22. Write generic fallback parser

### Phase 4b: Image Pipeline
23. Write image extractor (`src/lib/images/extractor.ts`) — parse `<img>` tags from email HTML for product thumbnails
24. Write image downloader (`src/lib/images/downloader.ts`) — download image URLs to `data/images/{shipmentId}/`
25. Write product page scraper (`src/lib/images/scraper.ts`) — follow product URLs to fetch higher-res images
26. Write image serving API route (`/api/images/[...path]/route.ts`)
27. Write image upload API route (`/api/shipments/[id]/images/route.ts`)

### Phase 5: Sync Engine
28. Write sync orchestrator (`src/lib/sync/engine.ts`) — fetch, parse, dedup, store + trigger image extraction
29. Write shipment matching logic — match by tracking number, order number, or retailer+item
30. Write processor pipeline (`src/lib/sync/processor.ts`)
31. Write cron setup (`src/lib/sync/cron.ts`) — every 30 minutes
32. Wire up `instrumentation.ts` to start cron on server boot
33. Write sync API routes: `/api/sync/route.ts`

### Phase 6: Shipment API
34. Write shipment DB queries (`src/lib/shipments/queries.ts`) — CRUD + filtered list + image relations
35. Write API routes: `/api/shipments/route.ts` (GET list + POST manual), `/api/shipments/[id]/route.ts` (GET, PATCH, DELETE)
36. Write settings API route

### Phase 7: Dashboard UI
37. Build root layout with header, nav links (Dashboard, Settings)
38. Build status cards component — count per status, color-coded, clickable to filter (all 13 statuses)
39. Build shipment list table — sortable columns, pagination, product image thumbnails
40. Build status badge component — color mapping per status
41. Build search bar — debounced, searches item/order/tracking/retailer
42. Build filter bar — status, carrier, date range dropdowns
43. Build quick filter buttons — Overdue, Arriving Soon, Ready for Pickup, Recently Delivered, All Active
44. Wire dashboard page with real data from API

### Phase 8: Shipment Detail
45. Build shipment detail page (`/shipments/[id]`) with product image gallery
46. Build timeline component — visual status progression (all 13 statuses)
47. Build manual entry/edit form with zod validation + image upload
48. Build image gallery component — show all images, set primary, delete

### Phase 9: Overdue & ETA
49. Write overdue detection logic — configurable thresholds per origin (domestic 7d, international 30d, China 45d, Israel domestic 5d)
50. Write stuck detection — no status update for 7+ days while in transit
51. Write customs_held detection — identify customs-related status from carrier tracking keywords
52. Run overdue check after each sync and on dashboard load
53. Add overdue threshold settings to settings page

### Phase 10: Polish
54. Loading states with shadcn Skeleton
55. Error handling + toast notifications
56. Mobile responsive layout (cards stack, table becomes card list)
57. Test end-to-end with real Gmail data

---

## Key Design Decisions

- **No NextAuth.js** — single-user local app, direct OAuth2 with googleapis is simpler
- **Server Components by default** — dashboard queries DB directly, client components only for interactivity
- **Parser chain pattern** — each retailer has its own parser module, easy to add new ones
- **Email dedup via emailSync table** — every Gmail message ID recorded, prevents duplicate processing
- **OAuth tokens in SQLite** — stored in settings table, simpler than file-based for local app
- **Status is computed** — overdue/stuck statuses are recalculated based on time thresholds, not just from email

---

## Google Cloud Setup (manual prerequisite)

1. Create project at console.cloud.google.com
2. Enable Gmail API
3. Create OAuth 2.0 credentials (Web application)
4. Set redirect URI: `http://localhost:3000/api/auth/callback`
5. Add scope: `https://www.googleapis.com/auth/gmail.readonly`
6. Add your email as test user on consent screen
7. Copy Client ID + Secret to `.env.local`

---

## Dashboard UI Mockup

```
┌──────────────────────────────────────────────────────────────┐
│  Shipping Tracker                       [Settings] [Sync]    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐    │
│  │ All  │ │Order │ │Trans │ │Pickup│ │Deliv │ │Overd │    │
│  │  15  │ │  3   │ │  2   │ │  1   │ │  5   │ │  2   │    │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘    │
│                                                              │
│  Search: [_________________________________________]         │
│  Quick: [Overdue] [Arriving Soon] [Pickup] [Recent] [Active]│
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │      │ Status  │ Item        │ Retailer │Carrier │ ETA  ││
│  │──────│─────────│─────────────│──────────│────────│──────││
│  │ [img]│ Deliver │ AirPods Pro │ Amazon   │ USPS   │Feb 20││
│  │ [img]│ In Tran │ Phone Case  │ AliExpr  │ DHL    │Mar 15││
│  │ [img]│ Overdue │ USB Cable   │ eBay     │ FedEx  │Jan 10││
│  │ [img]│ Pickup  │ Keyboard    │ KSP      │ IsPost │Mar 1 ││
│  │ [img]│ Customs │ Headphones  │ AliExpr  │ DHL    │Mar 20││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  Last synced: 5 min ago                       [Sync Now]     │
└──────────────────────────────────────────────────────────────┘
```

---

## Shipment Detail View

```
┌─────────────────────────────────────────────────────────┐
│  ← Back to Dashboard                                    │
│                                                         │
│  ┌─────────────┐  AirPods Pro 2nd Gen                   │
│  │             │  Amazon  •  Order #112-3456789-0123456  │
│  │  [Product   │  Purchased: Feb 15, 2026               │
│  │   Image]    │  Product Page: amazon.com/... →         │
│  │             │                                         │
│  └─────────────┘  [Upload Image]                        │
│                                                         │
│  ● Ordered ─────────── Feb 15                           │
│  │                                                      │
│  ● Shipped ─────────── Feb 17                           │
│  │                                                      │
│  ● In Transit ──────── Feb 18                           │
│  │                                                      │
│  ● Delivered ────────── Feb 20                          │
│  │                                                      │
│  ● Picked Up ────────── Feb 21                          │
│                                                         │
│  Tracking: 1Z999AA10123456784  [Track on UPS →]         │
│  Carrier: UPS                                           │
│  ETA: Feb 20  •  Delivered: Feb 20                      │
│                                                         │
│  Status: [Picked Up ▼]   (manual override)              │
│  Notes: [________________________________]              │
│                                                         │
│  [Edit]  [Delete]                                       │
└─────────────────────────────────────────────────────────┘
```

---

## Overdue Thresholds (defaults)

| Origin | Days until overdue |
|--------|-------------------|
| Domestic (Israel) | 5 days |
| Domestic (US) | 7 days |
| International | 30 days |
| China / AliExpress | 45 days |
| Stuck detection | No update for 7+ days while in transit |

---

## Carrier Tracking URLs

| Carrier | Tracking URL Pattern |
|---------|---------------------|
| USPS | `https://tools.usps.com/go/TrackConfirmAction?tLabels={num}` |
| UPS | `https://www.ups.com/track?tracknum={num}` |
| FedEx | `https://www.fedex.com/fedextrack/?trknbr={num}` |
| DHL | `https://www.dhl.com/en/express/tracking.html?AWB={num}` |
| Israel Post | `https://israelpost.co.il/en/itemtrace?itemcode={num}` |
| Amazon Logistics | `https://www.amazon.com/progress-tracker/package/{num}` |

---

## Verification

1. **Setup**: Run `npm run dev`, verify app loads at localhost:3000
2. **DB**: Check `data/shipping-tracker.db` is created with all 6 tables
3. **OAuth**: Click "Connect Gmail" in settings, complete OAuth flow, verify token stored
4. **Sync**: Click "Sync Now", verify emails are fetched and parsed
5. **Images**: Verify product images are extracted from emails and saved to `data/images/`
6. **Dashboard**: Verify shipments appear with thumbnails, correct status, filtering works
7. **Detail**: Click a shipment, verify image gallery, full details, and timeline
8. **Statuses**: Test all 13 statuses — especially Picked Up, Ready for Pickup, Customs Held
9. **Overdue**: Verify items past ETA show as overdue with visual indicators
10. **Manual**: Add a manual shipment with uploaded image, verify it appears in dashboard
11. **Image upload**: Upload a custom image to a shipment, verify it displays
