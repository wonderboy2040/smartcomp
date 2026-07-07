# Smart Computers - Sales & Service Panel (Protected Edition v2.0)

Complete shop management panel for computers sales & service with **invoicing, quotations, GST, payments, WhatsApp enquiries and Google Sheets sync**.

This edition adds four major upgrades over the original:

| # | Feature | What it does |
|---|---------|--------------|
| 1 | **Google Sheets data protection** | DELETE is now soft-delete (rows marked `deleted=true`, never removed). `replaceAll` is permanently blocked. Schema migration is data-safe (appends columns, never clears). Your historical data can never be lost by a future code change or bug. |
| 2 | **4-digit PIN lock** | Set `APP_PIN` env var to lock the entire panel behind a PIN entry screen. The PIN is never stored in the browser - only a SHA-256 hash. |
| 3 | **Full PWA** | Installable on Android, iOS, desktop. Manifest, service worker, offline page, maskable icons, app shortcuts. Works offline (cached shell + stale API fallback). |
| 4 | **Fast add/remove** | Optimistic UI with a shared client-side cache. Delete disappears instantly (rollback on error). Add/edit update the UI immediately without waiting for a full refetch round-trip. |

---

## Table of Contents
1. [Architecture](#architecture)
2. [Quick Start (Local Dev)](#quick-start-local-dev)
3. [Deploy to Render](#deploy-to-render)
4. [Google Sheets + Apps Script Setup](#google-sheets--apps-script-setup)
5. [Setting the PIN](#setting-the-pin)
6. [PWA Installation](#pwa-installation)
7. [Data Protection Details](#data-protection-details)
8. [Performance Improvements](#performance-improvements)
9. [Environment Variables](#environment-variables)
10. [Troubleshooting](#troubleshooting)
11. [Upgrading From v1.x](#upgrading-from-v1x)

---

## Architecture

```
Browser (PWA)
   |
   |  HTTPS  (PIN cookie validated by Next.js middleware if APP_PIN is set)
   v
Next.js 16  (this repo)
   |   - UI: React 19 + shadcn/ui + Tailwind 4
   |   - API routes: /api/invoices, /api/items, /api/dashboard, ...
   |   - Optimistic cache: src/lib/api.ts
   |
   |  HTTPS  (server-to-server, no PIN)
   v
Google Apps Script Web App  (apps-script/code.gs)
   |
   v
Google Sheets  (your spreadsheet - the single source of truth)
   Sheets: Shop, Items, Customers, Suppliers, Invoices, Quotations,
           Payments, Enquiries, Settings
```

**No other database is used.** Google Sheets is the single source of truth. The Apps Script Web App is the only writer. The Next.js API routes proxy all reads/writes through it.

---

## Quick Start (Local Dev)

```bash
# 1. Install deps
npm install --include=dev

# 2. Copy env template
cp .env.example .env.local

# 3. Edit .env.local - set APPS_SCRIPT_URL (see Google Sheets setup below)
#    Optionally set APP_PIN to a 4-digit number

# 4. Run dev server
npm run dev
# Open http://localhost:3000
```

---

## Deploy to Render

1. Push this repo to your GitHub.
2. On Render: **New** -> **Web Service** -> connect your repo.
3. Render auto-detects `render.yaml`. Settings:
   - Build: `npm install --include=dev && npm run build`
   - Start: `npm run start`
   - Node 20.x (auto from `.nvmrc`)
4. Set environment variables in Render dashboard:
   - `APPS_SCRIPT_URL` = your Apps Script Web App URL (required)
   - `APP_PIN` = 4-digit PIN (recommended, optional)
5. Deploy. The first build takes ~3 min.

---

## Google Sheets + Apps Script Setup

### First-time setup
1. Go to https://sheets.new and create a new Google Sheet.
2. In the sheet: **Extensions** -> **Apps Script**.
3. Delete any boilerplate in `Code.gs`.
4. Open `apps-script/code.gs` from this repo, copy the **entire** file, paste it into the Apps Script editor.
5. Click **Deploy** -> **New deployment**.
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Authorize the script when prompted (Google will warn about permissions - this is normal because the script writes to your sheet).
7. Copy the **Web App URL** (ends with `/exec`). This is your `APPS_SCRIPT_URL`.

### Updating the Apps Script (when you update this repo)
1. Open your sheet -> Extensions -> Apps Script.
2. Paste the new `apps-script/code.gs` (overwrite the old one).
3. **Deploy** -> **Manage deployments** -> click the pencil icon on your existing deployment -> **Version: New version** -> **Deploy**.
4. The URL stays the same - no need to update `APPS_SCRIPT_URL`.

> **Data-safe migration**: The new `ensureAllSheets()` automatically adds the `deleted` column (and any other missing columns) to your existing sheets **without clearing any data**. All your existing rows are preserved.

---

## Setting the PIN

The PIN is a 4-digit (or up to 8-digit) numeric code required to access the panel.

### On Render
- Render dashboard -> your service -> **Environment** -> add `APP_PIN` = `1234` (or your choice) -> Save -> auto redeploy.

### Locally
- In `.env.local`: `APP_PIN="1234"`

### Behavior
- If `APP_PIN` is set: every visitor sees `/login` first. After entering the correct PIN, a 30-day cookie is set and they can use the panel.
- If `APP_PIN` is empty or unset: the panel is open (no PIN screen). This is backward-compatible with v1.x.
- The PIN itself is **never** stored in the cookie. Only `sha256(PIN + salt)` is stored, and the salt is hardcoded in the middleware - so even if the cookie leaks, the PIN cannot be reversed.
- To change the PIN: update the env var and redeploy. Existing cookies become invalid instantly.
- To disable PIN: set `APP_PIN=""` and redeploy.

### Changing / resetting the PIN
Just update the `APP_PIN` env var and redeploy. All existing login cookies immediately become invalid because the expected hash changes. Users will need to enter the new PIN on their next visit.

---

## PWA Installation

### Android (Chrome)
1. Open the deployed URL in Chrome.
2. Menu (three dots) -> **Install app** (or **Add to Home screen**).
3. The app appears in your app drawer with the SmartComp icon. Launching it opens full-screen, no browser chrome.

### iOS (Safari)
1. Open the deployed URL in Safari.
2. Tap the **Share** icon -> **Add to Home Screen**.
3. The app appears on your home screen with the SmartComp icon. Launching it opens in standalone mode.

### Desktop (Chrome / Edge)
1. Open the deployed URL.
2. Click the **install icon** in the address bar (or Menu -> **Install Smart Computers...**).
3. The app opens in its own window.

### What the PWA gives you
- **Offline shell**: if the network drops, you still see the app shell and the last-cached dashboard (stale data is shown with a background refetch when online again).
- **Fast loads**: static assets (`_next/static/*`) are cached and served instantly on repeat visits.
- **Installable**: no app store needed. Users install directly from the browser.
- **App shortcuts**: long-press the icon on Android to see shortcuts to Dashboard, New Invoice, Stock.
- **Maskable icons**: the icon adapts to different Android icon shapes.
- **Auto-update**: when you deploy a new version, the service worker detects it and activates on next reload.

---

## Data Protection Details

This is the most important upgrade. Three layers of protection ensure your Google Sheets data can never be deleted or overwritten, even by future bugs or feature changes:

### Layer 1: Apps Script (apps-script/code.gs)
- `deleteRow(sheet, id)` -> calls `softDeleteRow()` which sets `deleted=true` via `updateRow()`. The row stays in the sheet forever.
- `replaceAll(sheet, data)` -> returns an error. Never deletes anything.
- `purge` action -> returns an error. Never deletes anything.
- `listRows()` filters out `deleted=true` rows by default, so the UI doesn't show them.
- `ensureAllSheets()` is **data-safe**: it reads existing headers and only **appends** missing columns. It never calls `sheet.clear()` on a sheet that has data.

### Layer 2: Next.js server (src/lib/sheets-client.ts)
- `deleteRow()` -> calls the Apps Script `delete` action (which soft-deletes).
- `replaceAll()` -> throws an error immediately, **without even calling Apps Script**. So even if a future feature tries to call it, nothing happens.
- `bulkCreate()` still works (append-only, safe).

### Layer 3: API routes
- All `/api/[resource]/[id]` DELETE handlers call `deleteRow()` from `sheets-client.ts`, which now soft-deletes. No route needs to change.
- There is no "delete all" or "replace all" endpoint.

### What this means in practice
- When a user clicks "Delete" on an item in the UI, the item disappears from the list (because `listRows` filters `deleted=true`), but the row is still in the Google Sheet, marked `deleted=true`.
- If you ever need to recover a deleted row: open the Google Sheet, find the row, and set the `deleted` cell to `FALSE`. It will reappear in the UI on next refresh.
- You can also restore via Apps Script: run `restoreRow('Items', 'abc-123')` from the Apps Script editor.
- To **see** soft-deleted rows: run `listDeletedRows('Items')` from the Apps Script editor, or call the API with `?includeDeleted=true`.

### Backing up
Even with all this protection, you should still periodically **download your Google Sheet as CSV/XLSX** (File -> Download -> CSV) as an external backup. Google Sheets also has built-in version history (File -> Version history -> See version history) which gives you point-in-time recovery.

---

## Performance Improvements

The original app felt slow on add/remove because every mutation waited for two round-trips to Google Apps Script (which has 2-10s cold starts):
1. POST/PUT/DELETE to Apps Script (2-10s)
2. `refetch()` to reload the list (2-10s)
Total: 4-20s per action.

### The fix (src/lib/api.ts)
A shared client-side cache with optimistic updates:

- **`useFetch(url)`** now returns cached data **instantly** on re-mount. A background refetch happens if the cache is older than 30s.
- **`apiPost(url, body)`**: after the server returns the created item, it is prepended to every cached list variant (handles query-string variants like `/api/items?search=foo`). The UI updates immediately - no `refetch()` needed.
- **`apiPut(url, body)`**: after the server returns the updated item, it replaces the matching item in every cached list. UI updates immediately.
- **`apiDelete(url)`**: **true optimistic**. The item disappears from the UI **before** the server responds. If the server fails, the item is rolled back. This makes delete feel instant.
- **Dashboard invalidation**: every mutation marks `/api/dashboard` stale, so the dashboard refreshes in the background next time you visit it - but doesn't block the current action.

### What you'll notice
- Delete: item disappears instantly. (Previously: 4-20s spinner.)
- Add: after the POST completes (~2-5s, server-side), the new item appears immediately in the list. No second wait. (Previously: two sequential waits.)
- Edit: same as add - immediate list update after PUT completes.
- Switching tabs / re-entering a panel: instant (data is cached). Background refresh happens silently.
- First-ever load of each panel: still requires one Apps Script round-trip (unavoidable - that's where the data lives).

### Server-side cache (src/lib/sheets-client.ts)
The server also keeps a 5-minute in-memory cache per sheet, so multiple clients hitting the same data don't each trigger an Apps Script call. Mutations invalidate only the affected sheet + dashboard (not the whole cache).

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `APPS_SCRIPT_URL` | **Yes** | - | Google Apps Script Web App URL (ends with `/exec`) |
| `APP_PIN` | No | empty | 4-8 digit numeric PIN to lock the panel. Empty = open access. |
| `CRON_SECRET` | No | - | Bearer token for the auto-enquiry cron endpoint |
| `NEXT_TELEMETRY_DISABLED` | No | `1` | Disables Next.js telemetry |
| `NODE_ENV` | Auto | `production` | Set by the platform |

---

## Troubleshooting

### "APPS_SCRIPT_URL not configured"
Set the `APPS_SCRIPT_URL` env var in Render (or `.env.local` locally) to your Apps Script Web App URL.

### Apps Script returns 401/403
Re-deploy the Apps Script as a Web App with "Who has access: **Anyone**". If you restricted it, the server can't call it.

### PIN screen keeps appearing even after login
- Make sure `APP_PIN` is set to digits only (e.g. `1234`), not quoted with spaces.
- Clear browser cookies for the domain and log in again.
- Check the server logs - the `/api/auth/login` route returns 401 if the PIN doesn't match.

### PWA install prompt doesn't appear
- Chrome requires HTTPS (Render provides this).
- The manifest must be valid - check `/manifest.json` loads (open it in the browser).
- The service worker must register - check DevTools -> Application -> Service Workers.
- iOS Safari doesn't show a prompt - users must manually use Share -> Add to Home Screen.

### Service worker not updating
- Hard reload (Ctrl+Shift+R / Cmd+Shift+R).
- DevTools -> Application -> Service Workers -> **Update on reload** + **Bypass for network**.
- The SW checks for updates every hour and auto-activates on next reload.

### Data seems missing after upgrade
- The new `listRows()` filters out `deleted=true` rows. If you had rows with a `deleted` column set to something truthy, they'll be hidden. Set the cell to `FALSE` in the Google Sheet to show them again.
- Run `listDeletedRows('Items')` in the Apps Script editor to see all soft-deleted rows.

### Still slow?
- First load of each panel requires one Apps Script round-trip (2-10s cold start). Subsequent loads are instant (cached).
- If Apps Script is consistently slow, consider redeploying it (Deploy -> Manage deployments -> New version). Apps Script Web Apps can have stale instances.
- The free Render tier sleeps after 15 min of inactivity. First request after sleep takes ~30s to wake up. Upgrade to a paid plan for always-on.

---

## Upgrading From v1.x

If you're already running the original v1.x app and want to upgrade to this Protected Edition:

1. **Backup your Google Sheet first**: File -> Download -> CSV (do this for every sheet tab).
2. **Update Apps Script**: open your sheet -> Extensions -> Apps Script -> paste the new `apps-script/code.gs` (overwrite). Save. Deploy -> Manage deployments -> New version -> Deploy.
3. **Push this code to GitHub**: replace your repo with this code (or merge the changes).
4. **Set `APP_PIN`** in Render (optional but recommended).
5. **Redeploy on Render**.
6. **Verify**: open the panel. Your existing data should all be there. The `deleted` column will have been added to each sheet automatically (all existing rows get `deleted=false`).

Your existing data is **never** at risk during the upgrade - the data-safe `ensureAllSheets()` only appends the `deleted` column, it never touches existing rows.

---

## File Structure

```
.
├── apps-script/
│   └── code.gs                  # Google Apps Script backend (PROTECTED)
├── public/
│   ├── manifest.json            # PWA manifest
│   ├── sw.js                    # Service worker
│   ├── sw-register.js           # SW registration helper
│   ├── offline.html             # Offline fallback page
│   ├── icon-192.png             # PWA icon 192x192
│   ├── icon-512.png             # PWA icon 512x512
│   ├── icon-1024.png            # PWA icon 1024x1024
│   ├── apple-touch-icon.png     # iOS home screen icon
│   └── logo.svg                 # Logo
├── src/
│   ├── middleware.ts            # PIN protection middleware
│   ├── app/
│   │   ├── layout.tsx           # Root layout (PWA metadata + SW)
│   │   ├── page.tsx             # Main dashboard shell
│   │   ├── login/
│   │   │   └── page.tsx         # PIN entry page
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── login/route.ts
│   │       │   ├── logout/route.ts
│   │       │   └── status/route.ts
│   │       ├── sheets/sync/route.ts
│   │       ├── invoices/
│   │       ├── quotations/
│   │       ├── payments/
│   │       ├── enquiries/
│   │       ├── items/
│   │       ├── customers/
│   │       ├── suppliers/
│   │       ├── shop/
│   │       ├── dashboard/
│   │       └── ...
│   ├── lib/
│   │   ├── api.ts               # Optimistic UI + cache (PERFORMANCE)
│   │   ├── sheets-client.ts     # Apps Script client (PROTECTED)
│   │   ├── calc.ts
│   │   ├── pdf.ts
│   │   ├── whatsapp.ts
│   │   └── utils.ts
│   └── components/
│       ├── panels/              # Dashboard, Invoices, Stock, etc.
│       └── ui/                  # shadcn/ui components
├── render.yaml                  # Render deployment config
├── next.config.ts               # Next.js config (PWA headers)
├── package.json
└── .env.example
```

---

## License
Private project. All rights reserved.

---

## WhatsApp Cloud API Setup (Auto-Send + Auto-Capture Replies)

This edition includes a complete **WhatsApp Cloud API integration**. When configured, the panel will:

1. **Auto-send** enquiry messages from your business WhatsApp number (no manual "Send" button clicking)
2. **Auto-capture** supplier replies via webhook — replies appear in the WhatsApp panel automatically (every 15s refresh)
3. **Auto-parse** rates from the reply text using pattern matching
4. Fall back to wa.me manual mode if Cloud API env vars are not set

### Prerequisites
- A **Meta Business account** (free) — create at https://business.facebook.com
- A **new phone number** with a SIM you don't use for personal WhatsApp (Cloud API requires migrating the number away from any existing WhatsApp account)
- ~15 minutes for setup + ~2 hours for template approval

### Step-by-step setup

#### 1. Create Meta Business account
1. Go to https://business.facebook.com → log in with Facebook → create a Business Account.
2. Verify your business (you can skip business verification for development mode, but you'll need it for production).

#### 2. Create a Meta App with WhatsApp
1. Go to https://developers.facebook.com/apps → **Create App** → **Business** type.
2. Add product: **WhatsApp**.
3. Note your **App ID** and **App Secret**.

#### 3. Add your business phone number
1. In the WhatsApp product → **Phone Numbers** → **Add Phone Number**.
2. Enter a number that is NOT currently registered with WhatsApp (you'll get an SMS/voice verification code).
3. Note the **Phone Number ID** (long number, ~15 digits) — this becomes `WA_PHONE_NUMBER_ID`.

#### 4. Generate a permanent access token
1. In the WhatsApp product → **API Setup** → **Generate Access Token**.
2. **IMPORTANT**: Copy it immediately — you won't see it again. This becomes `WA_TOKEN`.
3. Make it permanent: System User → Add → assign `whatsapp_business_messaging` permission.

#### 5. Create the "rate_enquiry" message template
1. In WhatsApp → **Message Templates** → **Create Template**.
2. Name: `rate_enquiry`, Language: `English (en)`, Category: `Marketing` or `Utility`.
3. Body (use exactly these placeholders):
   ```
   Hello {{1}}, please provide latest rates for the following items:

   {{2}}

   Please reply in this format so I can update my records:
   1. Item Name: Rs.XXXX (GST: Yes/No)
   2. ...

   Thank you!
   ```
4. Submit for review — approval takes ~2 hours (sometimes up to 24h).

#### 6. Set environment variables in Render
In your Render service → **Environment** → add:
| Key | Value |
|-----|-------|
| `WA_TOKEN` | your permanent access token |
| `WA_PHONE_NUMBER_ID` | phone number ID from step 3 |
| `WA_BUSINESS_NUMBER` | your business number in E.164 (e.g. `919876543210`, no `+`) |
| `WA_VERIFY_TOKEN` | any random string (e.g. `smartcomp_wh_2026`) — you'll reuse this in the webhook config |
| `WA_TEMPLATE_NAME` | `rate_enquiry` (or your custom name) |

#### 7. Configure the webhook (incoming replies)
1. In WhatsApp → **Configuration** → **Webhook**.
2. **Callback URL**: `https://your-render-domain.com/api/whatsapp/webhook`
3. **Verify Token**: the same value you set as `WA_VERIFY_TOKEN`.
4. Click **Verify and Save** — Meta will send a GET challenge, our server validates it.
5. Under **Webhook fields**, subscribe to: `messages` (and optionally `message_status`).

#### 8. Test
1. In your panel → **Settings → WhatsApp** tab → enter a test phone → **Send Test**.
2. The recipient must have messaged your business number in the last 24h (otherwise you'll get a "template required" error — that's normal, use Generate Messages which uses the template).
3. When a supplier replies, their reply will appear in the WhatsApp panel within ~15 seconds, automatically parsed into rates.

### Important notes

- **Free tier**: Meta gives 1000 service conversations per month for free. Each initiated conversation with a supplier counts as 1.
- **24h window**: After a supplier replies, you have 24h to send free-text messages to them. Outside that window, only templates work.
- **Template required for first contact**: Until a supplier has replied to you, you can ONLY send template messages (not free text). The code handles this automatically — `Generate Messages` always uses the template.
- **Phone number format**: Make sure supplier phone numbers in your Google Sheet are in E.164 format (country code + number, e.g. `919876543210`). The code normalizes common formats (10-digit → assumes India `91`).
- **Webhook URL must be HTTPS**: Render provides this automatically.
- **Don't use your personal number**: Once a number is registered with Cloud API, it can't be used in the regular WhatsApp app simultaneously. Use a dedicated business SIM.

### Troubleshooting WhatsApp Cloud API

**"template not found" / "template parameter count mismatch"**
- Make sure the template body in Meta matches exactly: two `{{1}}` and `{{2}}` placeholders.
- Wait for template approval status to be "Approved" (not "Pending" or "Rejected").
- Check the template language is `en` (not `en_US` or `en_GB`).

**Webhook verification fails**
- Make sure `WA_VERIFY_TOKEN` in Render matches exactly what you entered in Meta.
- Make sure the URL is `https://` (not `http://`).
- Check Render logs for the GET request from Meta.

**Messages send but replies don't appear**
- Verify webhook is subscribed to `messages` field (not just `message_status`).
- Check the supplier's phone number in your Google Sheet matches the number they're replying from (the webhook matches by phone).
- Look at Render logs for the incoming POST — our webhook returns `{success: true, handled: N}`.

**"recipient phone number not in allowed list" (development mode)**
- In development mode, you can only send to test phone numbers you've added in WhatsApp → API Setup → "To" field. Add your supplier numbers there, or complete business verification to go live.

**Want to disable Cloud API and go back to manual wa.me mode?**
- Set `WA_TOKEN=""` (empty) in Render and redeploy. The app automatically falls back to opening wa.me tabs.

---

## Migrating WhatsApp Business App Number to Cloud API

If you already use the WhatsApp Business app on a number and want to move it to Cloud API (so the panel can auto-send + auto-capture replies from that same number), you need to do a **number migration**. This is a one-time process.

### What happens after migration
- The WhatsApp Business app on that number **stops working** (you can't use it on your phone anymore for that number)
- All sending/receiving goes through Cloud API (via this panel)
- **Suppliers see messages from the same number** — no disruption for them
- You can still receive voice calls / SMS on that number normally (only WhatsApp is affected)

### Step-by-step migration (via the panel UI)

**Prerequisite**: Complete steps 1-4 of the regular Cloud API setup (Meta Business account, WhatsApp app, phone number ID, access token, env vars in Render). The number you added in Meta must be the SAME number that's currently in your WhatsApp Business app.

1. Go to **Settings → WhatsApp** tab in the panel.
2. Scroll to **"Migrate WhatsApp Business Number"** card.
3. Click **"Request Migration Code"** — Meta will SMS a 6-digit code to your business number.
4. Enter the 6-digit code in the input field.
5. Click **"Complete Migration"**.
6. Done! Your number is now on Cloud API. The WhatsApp Business app on your phone will show "This account is registered on WhatsApp Business API" and stop working.

### Troubleshooting migration

**"This phone number is already registered" error during request**
- The number is already on Cloud API. You don't need to migrate. Try sending a test message directly.

**"Invalid code" or "code expired"**
- The 6-digit code is valid for ~10 minutes. Click "Resend code" to get a new one.
- Make sure you're entering the code from the SMS sent to the BUSINESS number (not your personal number).

**Migration succeeded but messages don't send**
- Wait 2-5 minutes for Meta to fully provision the number.
- Check the test-send in Settings → WhatsApp → "Send Test Message".
- Make sure your template `rate_enquiry` is approved.

**Want to move the number back to WhatsApp Business app**
- Use the "Deregister Number" button (in the Advanced section of the Migration card).
- After deregister, install WhatsApp Business app fresh on your phone and register with the same number (you'll get a fresh SMS verification).

### Important: Don't migrate your personal number
If you migrate your personal WhatsApp number (the one you use to chat with friends/family), you will lose access to all your personal chats. Only migrate a **business-dedicated number**.

---

## Chat Export Mode (WhatsApp Business App + Free Auto-Capture)

If you want to keep using the WhatsApp Business mobile app normally AND still capture supplier replies into the panel automatically (without paying for Cloud API or a BSP), use **Chat Export mode**.

This mode is **free, requires no Meta setup, and works with your existing WhatsApp Business app**. The trade-off: importing replies is semi-manual (10 seconds per supplier — you tap "Export Chat" and upload the file).

### How it works

1. You send enquiries via the panel — wa.me links open in WhatsApp, you tap Send manually (as before).
2. Suppliers reply to your WhatsApp Business app normally.
3. When you want to capture replies into the panel:
   - Open WhatsApp Business app → open the supplier's chat
   - Tap ⋮ → More → **Export Chat** → **Without Media** → save/share the .txt file
   - In the panel: WhatsApp → **Import Chat** button → upload the .txt file
4. The panel auto-detects the supplier, parses their replies, extracts rates, and matches to the open enquiry.
5. You can then "Apply Rates to Dashboard" as usual.

### Advantages
- ✅ 100% free, no Meta Business account, no Cloud API
- ✅ WhatsApp Business app keeps working normally on your phone
- ✅ All your existing chats, broadcast lists, catalog, auto-replies stay intact
- ✅ No risk of account ban (uses only official WhatsApp features)
- ✅ Works with any number of suppliers

### Limitations
- ⚠️ Sending is still manual (wa.me links → tap Send in each tab)
- ⚠️ Reply capture is semi-manual (export + upload, ~10 sec per supplier)
- ⚠️ No real-time auto-capture (you decide when to import)

### When to use which mode

| Mode | Setup | Cost | Send | Reply Capture |
|------|-------|------|------|----------------|
| **Chat Export** (this) | None | Free | Manual (wa.me) | Semi-manual (export + upload) |
| **Cloud API** | Meta Business + SIM | Free (1000/mo) | Auto | Real-time webhook |
| **wa.me (basic)** | None | Free | Manual | Manual paste |

To use Chat Export mode: just leave `WA_TOKEN` env var empty. The "Import Chat" button in the WhatsApp panel will appear automatically.
