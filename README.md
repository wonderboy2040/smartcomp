# Smart Computers - Sales & Service Shop Management Panel

A complete shop management panel for computers sales & service businesses. **No database needed** - all data is stored directly in your Google Sheet via Apps Script. Works on Render/Vercel **free tier**.

## Architecture (New!)

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Any Device     │     │  Next.js App     │     │  Google Sheet   │
│  (Browser)      │────▶│  (Render/Vercel) │────▶│  (Apps Script)  │
│                 │     │                  │     │                 │
│  Multi-device   │     │  APPS_SCRIPT_URL │     │  All data here  │
│  support        │     │  env var         │     │  8 sheets       │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

- **No SQLite, no PostgreSQL** - Google Sheet is your database
- **One-time setup** - just set `APPS_SCRIPT_URL` env var
- **Multi-device** - any device with the URL sees the same data
- **Free tier** - works on Render/Vercel free tier (no database to pay for)

## Features

### 1. Dashboard
- Gradient hero cards with key metrics (sales, profit, stock value, outstanding credit)
- Cash vs Credit vs Profit breakdown
- Recent invoices, pending payments, low stock alerts, WhatsApp enquiries
- Smart empty states

### 2. Stock Management
- GST 18% toggle (with multiple rates: 0/5/12/18/28%)
- Cost & selling prices, HSN codes, min quantity alerts
- Supplier linkage, search & filter

### 3. Invoice Creation (A4 PDF)
- Pick from stock or custom items
- Auto-calc: subtotal, GST, courier, other charges, discount
- Profit calculation, partial payments, stock auto-deduct
- A4 PDF generation, WhatsApp share

### 4. Quotation Creation (A4 PDF)
- Same item picker, valid till date
- One-click convert to invoice

### 5. Payments
- Pending & History tabs
- Cash/UPI/Card/Bank/Cheque types
- WhatsApp payment reminders

### 6. Customers & Suppliers
- Full CRM with GSTIN, credit balance tracking
- Supplier WhatsApp numbers for enquiries

### 7. WhatsApp Rate Enquiry (2x Monthly)
- Bulk send to selected suppliers
- Capture supplier response (auto-parse rates)
- Apply rates to dashboard with one click
- Auto-enquiry on 1st & 15th via cron

### 8. Google Sheets Sync (Built-in)
- All data lives in your Google Sheet
- 8 sheets: Shop, Items, Customers, Suppliers, Invoices, Quotations, Payments, Enquiries
- Real-time sync, no manual intervention

## One-Time Setup (3 Steps)

### Step 1: Create Google Sheet & Add Apps Script

1. Go to [sheets.new](https://sheets.new) - create a new Google Sheet
2. In the sheet: **Extensions → Apps Script**
3. Delete any existing code
4. Open `apps-script/code.gs` from this project
5. Copy ALL the content and paste into the Apps Script editor
6. Save (Ctrl+S)

### Step 2: Deploy as Web App

1. In Apps Script: **Deploy → New deployment**
2. Click gear icon → choose **Web app**
3. Description: "Smart Computers Sync"
4. Execute as: **Me (your email)**
5. Who has access: **Anyone**
6. Click **Deploy**
7. Authorize when prompted (Advanced → Go to project → Allow)
8. Copy the **Web App URL** (ends with `/exec`)

### Step 3: Set Environment Variable

When deploying to Render or Vercel, set this environment variable:

```
APPS_SCRIPT_URL = https://script.google.com/macros/s/AKfycb.../exec
```

That's it! The app will automatically detect the env var and load. All devices accessing your deployed URL will see the same data from your Google Sheet.

## Local Development

```bash
# Install dependencies (npm or bun)
npm install

# Set env var
cp .env.example .env
# Edit .env and add your APPS_SCRIPT_URL

# Start dev server
npm run dev
```

Open `http://localhost:3000`. If `APPS_SCRIPT_URL` is not set, you'll see a setup wizard with instructions.

## Deployment

### Render (Recommended - Free Tier Works!)

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → New **Web Service**
3. Connect your GitHub repo
4. Settings auto-detected from `render.yaml`:
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
5. In Render dashboard, add environment variable:
   - `APPS_SCRIPT_URL` = your Apps Script Web App URL
6. Deploy!

**Important**: 
- Use `npm` commands, NOT `bun` (Render doesn't have bun installed by default)
- No database service needed - data is in Google Sheets

### Vercel

1. Push to GitHub
2. Go to [vercel.com](https://vercel.com) → Import repo
3. Add environment variable:
   - `APPS_SCRIPT_URL` = your Apps Script Web App URL
4. Deploy!

Vercel also supports the auto-enquiry cron job (1st & 15th of month) via `vercel.json`.

## WhatsApp Setup

- No API needed! Uses `wa.me` links (free)
- Click "Send Enquiry" → WhatsApp opens with pre-filled message
- Paste supplier's reply in response dialog → auto-parse rates
- Click "Apply Rates to Dashboard" to update stock prices

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `APPS_SCRIPT_URL` | **Yes** | Google Apps Script Web App URL |
| `CRON_SECRET` | No | Secret for auto-enquiry cron job |
| `NEXT_TELEMETRY_DISABLED` | No | Disable Next.js telemetry |

## File Structure

```
.
├── apps-script/
│   └── code.gs              # Google Apps Script (paste in your Sheet)
├── src/
│   ├── app/
│   │   ├── api/              # API routes (proxy to Apps Script)
│   │   ├── layout.tsx
│   │   └── page.tsx          # Main app with setup wizard
│   ├── components/
│   │   ├── panels/           # 9 main panels
│   │   ├── SetupWizard.tsx   # One-time setup screen
│   │   └── ui/               # shadcn/ui components
│   └── lib/
│       ├── api.ts            # Frontend fetch helpers
#       ├── calc.ts           # Invoice/GST/profit calculations
#       ├── pdf.ts            # PDF generation (A4)
#       ├── sheets-client.ts  # Apps Script caller (server-side)
#       └── whatsapp.ts       # WhatsApp link + rate parser
├── render.yaml               # Render config (no DB needed)
├── vercel.json               # Vercel config with cron
├── .env.example
└── README.md
```

## Why This Architecture?

1. **Free hosting** - No database means Render/Vercel free tier works perfectly
2. **Multi-device** - All devices access the same Google Sheet via the deployed app
3. **One-time setup** - Set `APPS_SCRIPT_URL` once, never touch it again
4. **Data ownership** - Your data stays in your Google Sheet, not locked in a vendor DB
5. **Easy backup** - Just backup your Google Sheet
6. **No migrations** - Apps Script handles schema automatically

## Troubleshooting

### HTTP 502 Error on Render

**Cause**: App failed to start. Most common reasons:

1. **Using `bun` instead of `npm`**: Render Node runtime doesn't have bun.
   - ✅ Fix: Use `npm install && npm run build` for build, `npm run start` for start
   - render.yaml already configured correctly

2. **Missing `APPS_SCRIPT_URL` env var**: App won't start without it.
   - Go to Render dashboard → your service → Environment
   - Add `APPS_SCRIPT_URL` with your Apps Script Web App URL

3. **Build failed**: Check Render build logs for errors.
   - Common: Missing dependencies, TypeScript errors
   - Our config has `typescript.ignoreBuildErrors: true` to skip TS issues

4. **Port issue**: Render assigns PORT=10000 automatically.
   - Next.js standalone server reads `PORT` env var automatically
   - render.yaml has `PORT: "10000"` set

### Render Free Tier Sleep Issue

Render free tier sleeps after 15 min of inactivity. First request after sleep takes 30-50 sec.

**Solutions**:
- Use [UptimeRobot](https://uptimerobot.com) (free) to ping your URL every 10 min
- Or upgrade to paid plan ($7/month)

### Google Sheets Connection Failed

1. Verify Apps Script is deployed as **Web app** (not API)
2. Check "Who has access" is set to **Anyone**
3. Copy the URL ending with `/exec` (not `/dev`)
4. Test in Apps Script editor: Run → `testSetup` function

### App Loads but Shows "Not Configured"

- `APPS_SCRIPT_URL` env var not set on Render/Vercel
- OR env var set but app needs redeploy
- Try: Render dashboard → Manual Deploy → Clear cache & deploy

## License

MIT - Free for commercial use
