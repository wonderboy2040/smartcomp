# SmartComp — Sales & Service Panel

A focused shop-management web app for computer sales & service stores.
Built with Next.js 15 + React 18 + Tailwind 4 + shadcn/ui, backed by Google Sheets
through a Google Apps Script web app.

## Core Modules

- Dashboard — sales, stock, outstanding, payments, jobs, profit share
- Stock — items, low-stock alerts, cost/sell tracking
- Invoices — 10 premium GST templates, A4 print, HSN summary, UPI QR
- Quotations — convert to invoice in one click
- Payments — collection tracking, partial payments
- Customers / Suppliers — contact + GST + outstanding
- WhatsApp Enquiry — bulk supplier rate enquiries
- Service Jobs — stock-linked parts, engineer/admin profit share
- Service Payments — separate payment ledger for jobs
- Serials & Warranty — IMEI / serial tracking
- AMC Contracts — annual maintenance contracts
- Shop Expenses / Personal Expenditure
- Campaigns — bulk WhatsApp broadcasts
- Credit Control — overdue tracking
- Financials — P&L, cash-flow, balance sheet
- Reports — sales trend, top items, receivables aging
- Settings — Apps Script URL, PIN, shop profile

## Performance Notes

- Sheet-scoped cache invalidation (only the affected sheet is dropped on writes)
- Document preview opens instantly with a skeleton, then fills in /api/doc-data
- Shop config and product images cached server-side for 5 min
- 8 s / 10 s timeouts for Apps Script (cold starts can take 6-8 s)
- Lazy-loaded panels + optimistic UI for instant writes
- Periodic dashboard refresh (2 min) instead of aggressive live sync

## Running locally

```bash
npm install
npm run dev      # http://localhost:3000
```

For production:

```bash
npm run build
npm start
```

## Configuration

Set the following env vars (or use the in-app Setup Wizard / Settings panel):

```
APPS_SCRIPT_URL=https://script.google.com/macros/s/.../exec
APP_PIN=your-pin
NEXT_PUBLIC_BASE_URL=https://your-domain.com
```

For the Electron desktop build, see `electron-builder.yml` and `scripts/build-exe.js`.

## Apps Script backend

The Google Apps Script code lives in `apps-script/code.gs`. Use the Settings
panel → "Copy Apps Script code" button to grab the latest version, paste it
into a new Apps Script project, deploy as a Web App (Anyone access), and paste
the `/exec` URL back into SmartComp.
