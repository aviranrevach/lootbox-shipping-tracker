# Multi-Gmail Account Support

## Context
Currently the app supports a single Gmail account stored as `gmail_tokens` in the `settings` key-value table. The user wants to connect multiple Gmail accounts so shipping emails from all accounts are synced.

## Approach
Add a dedicated `gmail_accounts` table. Each row holds one account's email + tokens. Auth functions become account-aware. Sync iterates all accounts. `emailSync` gets an `account_email` column so the email viewer knows which account to use when fetching.

## Files to Change

### 1. `src/lib/db/schema.ts` — Add `gmailAccounts` table
```
gmailAccounts: id, email (unique), tokens (JSON), addedAt, lastSyncAt
```
Also add `accountEmail` column to `emailSync` table (nullable, for backward compat).

### 2. `src/lib/db/migrate-accounts.ts` — NEW: Startup migration
- `CREATE TABLE IF NOT EXISTS gmail_accounts` (self-healing)
- `ALTER TABLE email_sync ADD COLUMN account_email TEXT` (if not exists)
- Move legacy `gmail_tokens` from `settings` → `gmail_accounts` (fetch profile to get email)
- Delete legacy `settings` row
- Skip if already migrated (gmail_accounts has rows)

### 3. `src/instrumentation.ts` — Call migration before cron
- Import and run `migrateGmailTokens()` before `startCronJobs()`

### 4. `src/lib/gmail/auth.ts` — Rewrite for multi-account
Replace all functions:
- `storeAccountTokens(email, tokens)` — upsert into gmail_accounts
- `loadAccountTokens(email)` → Credentials | null
- `removeAccount(email)` — delete row
- `getConnectedAccounts()` → array of `{ id, email, addedAt, lastSyncAt }`
- `getAuthenticatedClientForAccount(email)` — load tokens, create client, persist refreshes
- `getFirstAuthenticatedClient()` — for backward compat (email viewer fallback)
- `isGmailConnected()` — returns true if any accounts exist (keep name for simpler migration)

### 5. `src/app/api/auth/callback/route.ts` — Discover email, store per-account
- After exchanging code for tokens, call `getGmailProfile()` to get email
- Call `storeAccountTokens(email, tokens)`
- Redirect with email in query params for toast

### 6. `src/app/api/auth/status/route.ts` — Return accounts array
Response: `{ connected: boolean, accounts: [{ email, addedAt }] }`

### 7. `src/app/api/auth/account/route.ts` — NEW: Remove account endpoint
- `DELETE ?email=...` → calls `removeAccount(email)`

### 8. `src/lib/sync/engine.ts` — Loop over all accounts
- `syncEmails()`: get all accounts, iterate sequentially, aggregate results
- Extract current per-email logic into `syncAccountEmails(client, afterDate)`
- Set `accountEmail` on each `emailSync` insert
- Update `lastSyncAt` per account after syncing

### 9. `src/lib/sync/cron.ts` — Update import
- `isGmailConnected` still works (renamed internally to check any account)

### 10. `src/app/api/sync/route.ts` — Update error message
- `isGmailConnected()` → same function, now checks any account

### 11. `src/app/api/emails/[messageId]/route.ts` — Account-aware email fetch
- Look up `emailSync` row by messageId to get `accountEmail`
- Use `getAuthenticatedClientForAccount(accountEmail)`
- Fallback to first connected account if `accountEmail` is null (legacy data)

### 12. `src/components/settings/settings-panel.tsx` — Multi-account UI
- State: `accounts: Array<{ email, addedAt }>`
- Show list of connected accounts, each with green dot + email + "Remove" button
- "Add Gmail Account" button (or "Connect Gmail" if none connected)
- `handleRemoveAccount(email)` → DELETE `/api/auth/account`

### 13. `src/app/settings/page.tsx` — Same UI changes as settings panel
- Mirror the multi-account list UI from the panel

## Implementation Order
1. Schema + migration (foundation)
2. Auth rewrite (core logic)
3. API routes (callback, status, new account endpoint)
4. Sync engine refactor
5. Email viewer route update
6. UI (settings panel + settings page)
7. Instrumentation wiring

## Verification
1. Start dev server → migration auto-creates table and moves existing tokens
2. Open Settings → existing account appears in the list
3. Click "Add Gmail Account" → OAuth flow → second account appears
4. "Sync Now" → both accounts' emails are fetched
5. Open a shipment's email → email loads correctly via correct account
6. Remove an account → it disappears, remaining account still works
