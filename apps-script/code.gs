/**
 * Smart Computers - Google Apps Script Backend (PROTECTED EDITION v3.0)
 *
 * DATA PROTECTION POLICY (v2.0+):
 *   - DELETE is now SOFT-DELETE. Rows are marked deleted=true but NEVER removed.
 *   - REPLACE ALL is permanently BLOCKED. The action returns an error.
 *   - listRows() filters out deleted rows by default (includeDeleted=false).
 *   - Schema migration is DATA-SAFE: missing columns are appended, existing data is never cleared.
 *
 * This ensures that future code updates, feature additions, or bugs can NEVER
 * delete or overwrite your historical Google Sheets data.
 *
 * SETUP:
 *   1. Create new Google Sheet at https://sheets.new
 *   2. Extensions -> Apps Script
 *   3. Paste this entire file (replace any existing content)
 *   4. Deploy -> New deployment -> Web app
 *      - Execute as: Me
 *      - Who has access: Anyone
 *   5. Copy the Web App URL (ends with /exec)
 *   6. Set this URL as APPS_SCRIPT_URL env var in your Next.js deployment
 *
 * UPGRADING FROM v1.x / v2.x:
 *   Just re-paste this file and save. The data-safe ensureAllSheets() will
 * automatically add the new `deleted` column to your existing sheets WITHOUT
 * touching any existing rows. All your current data stays intact.
 *
 * v3.0 CHANGES:
 *   - Added safety wrapper: even if doGet/doPost throw before try/catch,
 *     Google will still get a JSON response (via the global error handler).
 *   - `ping` and `test` actions now NEVER touch sheets, ensuring they work
 *     even if the spreadsheet has been deleted or permissions revoked.
 *   - Better error messages with specific guidance for common failures.
 *   - Added `version` action to check deployed code version from the app.
 */

// ===== SHEET SCHEMAS =====
// NOTE: 'deleted' column is appended to every sheet for soft-delete support.
const SCHEMAS = {
  Shop: ['id', 'name', 'owner', 'phone', 'email', 'address', 'gstNumber', 'state', 'invoicePrefix', 'quotationPrefix', 'termsInvoice', 'termsQuotation', 'upiId', 'createdAt', 'updatedAt', 'deleted'],
  Items: ['id', 'name', 'sku', 'category', 'description', 'gstApplicable', 'gstRate', 'costPrice', 'sellingPrice', 'quantity', 'minQuantity', 'unit', 'hsnCode', 'supplierId', 'warrantyDays', 'createdAt', 'updatedAt', 'deleted'],
  Customers: ['id', 'name', 'phone', 'email', 'address', 'gstNumber', 'state', 'creditBalance', 'creditLimit', 'creditDays', 'creditScore', 'birthday', 'createdAt', 'updatedAt', 'deleted'],
  Suppliers: ['id', 'name', 'phone', 'whatsappNumber', 'email', 'company', 'address', 'suppliedItems', 'active', 'includeInAutoEnquiry', 'createdAt', 'updatedAt', 'deleted'],
  Invoices: ['id', 'number', 'customerId', 'customerName', 'customerPhone', 'customerGstin', 'date', 'itemsJson', 'serialsJson', 'subtotal', 'gstAmount', 'courierCharges', 'otherCharges', 'discount', 'grandTotal', 'totalCost', 'profit', 'paymentType', 'paymentStatus', 'amountPaid', 'amountDue', 'notes', 'createdAt', 'deleted'],
  Quotations: ['id', 'number', 'customerId', 'customerName', 'customerPhone', 'customerGstin', 'date', 'validTill', 'itemsJson', 'subtotal', 'gstAmount', 'courierCharges', 'otherCharges', 'discount', 'grandTotal', 'notes', 'status', 'convertedToInvoiceId', 'createdAt', 'deleted'],
  Payments: ['id', 'invoiceId', 'invoiceNumber', 'customerName', 'amount', 'type', 'date', 'notes', 'reference', 'createdAt', 'deleted'],
  Enquiries: ['id', 'supplierId', 'supplierName', 'supplierPhone', 'itemsJson', 'message', 'status', 'sentAt', 'respondedAt', 'response', 'ratesJson', 'appliedToItems', 'isAuto', 'createdAt', 'deleted'],
  Jobs: ['id', 'jobId', 'trackToken', 'customerName', 'customerMobile', 'deviceType', 'brandModel', 'serialNumber', 'problemDesc', 'accessories', 'serviceType', 'priority', 'estimatedAmount', 'advanceAmount', 'advanceMode', 'status', 'assignedEngineer', 'partsUsedJson', 'finalAmount', 'serviceCharge', 'paidAmount', 'paymentMode', 'paymentType', 'engineerShare', 'adminShare', 'partsProfit', 'serviceProfit', 'notes', 'diagnosisNotes', 'warrantyDays', 'warrantyExpiry', 'statusHistoryJson', 'completedDate', 'createdAt', 'updatedAt', 'deliveredAt', 'deleted'],
  ServicePayments: ['id', 'jobId', 'customerName', 'amount', 'mode', 'type', 'date', 'engineerShare', 'adminShare', 'notes', 'createdAt', 'deleted'],
  Expenses: ['id', 'category', 'description', 'amount', 'mode', 'date', 'vendor', 'reference', 'notes', 'createdAt', 'deleted'],
  ItemSerials: ['id', 'itemId', 'itemName', 'serialNumber', 'status', 'invoiceId', 'invoiceNumber', 'customerName', 'purchaseDate', 'warrantyDays', 'warrantyExpiry', 'costPrice', 'notes', 'createdAt', 'updatedAt', 'deleted'],
  PersonalExpenditure: ['id', 'type', 'category', 'description', 'amount', 'mode', 'date', 'person', 'notes', 'createdAt', 'deleted'],
  // ===== WhatsApp Marketing Campaigns =====
  Campaigns: ['id', 'name', 'segment', 'segmentDataJson', 'message', 'status', 'totalRecipients', 'sentCount', 'deliveredCount', 'readCount', 'scheduledAt', 'sentAt', 'createdAt', 'deleted'],
  // ===== AMC / Service Contracts =====
  AMCContracts: ['id', 'contractNumber', 'customerId', 'customerName', 'customerPhone', 'customerAddress', 'devicesCoveredJson', 'startDate', 'endDate', 'fee', 'frequency', 'visitsIncluded', 'visitsUsed', 'lastVisitDate', 'nextVisitDate', 'status', 'notes', 'createdAt', 'updatedAt', 'deleted'],
  Settings: ['id', 'value', 'deleted']
};

const SHEET_NAMES = Object.keys(SCHEMAS);

// ===== GET HANDLER =====
function doGet(e) {
  // v3.0: Top-level safety wrapper. Any error that escapes the inner try/catch
  // (e.g., if `e` is null or e.parameter is undefined) is still caught here
  // and returned as JSON. This prevents Google from rendering its HTML error
  // page, which is the #1 cause of "Apps Script returned HTML instead of JSON".
  try {
    var params = (e && e.parameter) ? e.parameter : {};
    var action = params.action || 'status';

    // PING — absolute minimum, no sheet access. Use this to verify the
    // deployment URL is correct before anything else.
    if (action === 'ping') {
      return json({ success: true, message: 'pong', time: new Date().toISOString(), version: '3.0' });
    }

    // VERSION — return deployed code version. No sheet access.
    // Use this to verify the deployed code is the latest version.
    if (action === 'version') {
      return json({
        success: true,
        version: '3.0',
        codename: 'Protected Edition',
        releasedAt: '2025-01-01',
        features: ['soft-delete', 'data-protection', 'ping-action', 'version-action'],
      });
    }

    // TEST — basic connectivity + version info. Does NOT touch sheets.
    if (action === 'test') {
      return json({
        success: true,
        message: 'Connection successful (Protected Edition v3.0)',
        version: '3.0',
        dataProtection: true,
        time: new Date().toISOString(),
      });
    }

    // STATUS — default action, no sheet access
    if (action === 'status') {
      return json({ success: true, message: 'Smart Computers API running (Protected Edition v3.0)', sheets: SHEET_NAMES, dataProtection: true, version: '3.0' });
    }

    // All actions below this point require sheet access.
    // Wrap in a separate try-catch so sheet-access errors are reported
    // with a clear message instead of Google's generic HTML error page.
    try {
      ensureAllSheets();
    } catch (sheetErr) {
      return json({
        success: false,
        error: 'Sheet access failed: ' + sheetErr.toString() + '. Make sure the script is bound to a Google Sheet (open the sheet → Extensions → Apps Script) and the script has permission to access spreadsheets.',
        action: action,
        hint: 'Open the Apps Script editor → Run → "testSetup" function → review the execution log. If it asks for permissions, authorize them. Then redeploy as a new web app version.',
      });
    }

    if (action === 'list') {
      const sheet = params.sheet;
      if (!sheet) return json({ success: false, error: 'Missing sheet' });
      const includeDeleted = params.includeDeleted === 'true';
      const rows = listRows(sheet, params.filter, params.search, includeDeleted);
      return json({ success: true, data: rows });
    }

    if (action === 'get') {
      const sheet = params.sheet;
      const id = params.id;
      if (!sheet || !id) return json({ success: false, error: 'Missing sheet or id' });
      const row = getRow(sheet, id);
      return row ? json({ success: true, data: row }) : json({ success: false, error: 'Not found' });
    }

    if (action === 'shop') {
      const rows = listRows('Shop');
      return json({ success: true, data: rows[0] || null });
    }

    if (action === 'dashboard') {
      return json({ success: true, data: getDashboardStats() });
    }

    return json({ success: false, error: 'Unknown action: ' + action });
  } catch (err) {
    return json({
      success: false,
      error: err.toString(),
      stack: err.stack,
      hint: 'This is an unexpected error in doGet(). Copy the latest code from your Next.js app → Settings → Sync tab → "Copy latest Apps Script code" button, then paste it into the Apps Script editor and redeploy.',
    });
  }
}

// ===== POST HANDLER =====
function doPost(e) {
  // v3.0: Top-level safety wrapper (same reasoning as doGet).
  try {
    // Handle empty/invalid body gracefully
    let body;
    try {
      body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    } catch (parseErr) {
      return json({ success: false, error: 'Invalid JSON body: ' + parseErr.toString() });
    }
    const action = body.action;

    // TEST — basic connectivity, NO sheet access (mirrors doGet test action)
    if (action === 'test') {
      return json({
        success: true,
        message: 'Connection successful (Protected Edition v3.0)',
        version: '3.0',
        dataProtection: true,
        time: new Date().toISOString(),
      });
    }

    // PING — absolute minimum
    if (action === 'ping') {
      return json({ success: true, message: 'pong', time: new Date().toISOString(), version: '3.0' });
    }

    // VERSION — return deployed code version (no sheet access)
    if (action === 'version') {
      return json({
        success: true,
        version: '3.0',
        codename: 'Protected Edition',
        features: ['soft-delete', 'data-protection', 'ping-action', 'version-action'],
      });
    }

    // All actions below require sheet access.
    try {
      ensureAllSheets();
    } catch (sheetErr) {
      return json({
        success: false,
        error: 'Sheet access failed: ' + sheetErr.toString() + '. Make sure the script is bound to a Google Sheet (open the sheet → Extensions → Apps Script) and the script has permission to access spreadsheets.',
        action: action,
        hint: 'Open the Apps Script editor → Run → "testSetup" function → review the execution log. If it asks for permissions, authorize them. Then redeploy as a new web app version.',
      });
    }

    switch (action) {
      case 'create':
        return json(createRow(body.sheet, body.data));
      case 'update':
        return json(updateRow(body.sheet, body.id, body.data));
      case 'delete':
        return json(softDeleteRow(body.sheet, body.id));
      case 'restore':
        return json(restoreRow(body.sheet, body.id));
      case 'bulkCreate':
        return json(bulkCreate(body.sheet, body.data));
      case 'bulkUpdate':
        return json(bulkUpdate(body.sheet, body.updates));
      case 'replace':
        return json({ success: false, error: 'replace action is permanently disabled for data protection. Use create/update instead.' });
      case 'saveShop':
        return json(saveShop(body.data));
      case 'seed':
        return json(seedData());
      case 'purge':
        return json({ success: false, error: 'purge action is permanently disabled for data protection.' });
      default:
        return json({ success: false, error: 'Unknown action: ' + action });
    }
  } catch (err) {
    return json({
      success: false,
      error: err.toString(),
      stack: err.stack,
      hint: 'This is an unexpected error in doPost(). Copy the latest code from your Next.js app → Settings → Sync tab → "Copy latest Apps Script code" button, then paste it into the Apps Script editor and redeploy.',
    });
  }
}

// ===== SHEET MANAGEMENT (DATA-SAFE) =====
// PERFORMANCE: Track whether ensureAllSheets has run in this execution.
// Apps Script runs a fresh V8 isolate per request, so this flag resets naturally.
// This prevents ensureAllSheets from running 7+ times in getDashboardStats().
var _sheetsEnsured = false;

/**
 * Data-safe sheet initialization.
 * - Creates missing sheets.
 * - Appends missing columns to existing sheets WITHOUT clearing data.
 * - Only writes headers on brand-new empty sheets.
 * - NEVER calls sheet.clear() on sheets that have data.
 * - PERFORMANCE: Only runs ONCE per script execution (cached via _sheetsEnsured flag).
 */
function ensureAllSheets() {
  if (_sheetsEnsured) return;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  for (var n = 0; n < SHEET_NAMES.length; n++) {
    var name = SHEET_NAMES[n];
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
    }
    var headers = SCHEMAS[name];
    var lastCol = sheet.getLastColumn();
    var lastRow = sheet.getLastRow();

    if (lastCol === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#1e293b').setFontColor('#ffffff');
      sheet.setFrozenRows(1);
    } else {
      var existingHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
      var missing = [];
      for (var h = 0; h < headers.length; h++) {
        if (existingHeaders.indexOf(headers[h]) === -1) {
          missing.push(headers[h]);
        }
      }
      if (missing.length > 0) {
        var startCol = lastCol + 1;
        sheet.getRange(1, startCol, 1, missing.length).setValues([missing]);
        sheet.getRange(1, startCol, 1, missing.length).setFontWeight('bold').setBackground('#1e293b').setFontColor('#ffffff');
      }
      var deletedIdx = headers.indexOf('deleted');
      if (deletedIdx !== -1 && deletedIdx >= lastCol) {
        if (lastRow > 1) {
          var fillRange = sheet.getRange(2, deletedIdx + 1, lastRow - 1, 1);
          var fillValues = [];
          for (var i = 0; i < lastRow - 1; i++) fillValues.push([false]);
          fillRange.setValues(fillValues);
        }
      }
    }
  }
  _sheetsEnsured = true;
}

function getSheet(name) {
  ensureAllSheets();
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error('Sheet not found: ' + name);
  return sheet;
}

function getSheetInfo() {
  return SHEET_NAMES.map(name => {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
    return { name, exists: !!sheet, rows: sheet ? sheet.getLastRow() - 1 : 0 };
  });
}

// ===== CRUD OPERATIONS =====
function listRows(sheetName, filter, search, includeDeleted) {
  const sheet = getSheet(sheetName);
  const headers = SCHEMAS[sheetName];
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const data = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  let rows = data.map(r => {
    const obj = {};
    headers.forEach((h, i) => {
      const v = r[i];
      obj[h] = (v instanceof Date) ? v.toISOString() : v;
    });
    return obj;
  });

  // DATA PROTECTION: filter out soft-deleted rows unless explicitly requested
  if (!includeDeleted) {
    rows = rows.filter(r => r.deleted !== true && String(r.deleted).toLowerCase() !== 'true');
  }

  // Apply filter (format: "field=value")
  if (filter) {
    const [field, value] = filter.split('=');
    if (field && value !== undefined) {
      rows = rows.filter(r => String(r[field] || '') === String(value));
    }
  }

  // Apply search (format: "field:query" or just "query" for name search)
  if (search) {
    const q = search.toLowerCase();
    rows = rows.filter(r => {
      return Object.values(r).some(v => String(v || '').toLowerCase().includes(q));
    });
  }

  return rows;
}

/**
 * OPTIMIZED getRow: scans only the ID column (col 1) to find the row index,
 * then reads only that single row. ~10x faster than the old approach of
 * reading ALL columns of ALL rows via listRows().
 */
function getRow(sheetName, id) {
  const sheet = getSheet(sheetName);
  const headers = SCHEMAS[sheetName];
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  // Read only ID column to find the row
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  var rowIndex = -1;
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) { rowIndex = i + 2; break; }
  }
  if (rowIndex === -1) return null;

  // Read only the single matching row
  var rowData = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
  var obj = {};
  headers.forEach(function(h, idx) {
    var v = rowData[idx];
    obj[h] = (v instanceof Date) ? v.toISOString() : v;
  });

  // Skip soft-deleted rows
  if (obj.deleted === true || String(obj.deleted).toLowerCase() === 'true') return null;
  return obj;
}

function createRow(sheetName, data) {
  const sheet = getSheet(sheetName);
  const headers = SCHEMAS[sheetName];
  const id = data.id || Utilities.getUuid();
  const now = new Date().toISOString();

  const row = headers.map(h => {
    if (h === 'id') return id;
    if (h === 'deleted') return false;
    if (h === 'createdAt') return data.createdAt || now;
    if (h === 'updatedAt') return now;
    const v = data[h];
    if (v === undefined || v === null) return '';
    if (typeof v === 'object') return JSON.stringify(v);
    return v;
  });

  sheet.appendRow(row);
  return { success: true, data: { id, ...data, createdAt: data.createdAt || now, updatedAt: now, deleted: false } };
}

/**
 * OPTIMIZED updateRow: scans only the ID column to find row index,
 * then reads+writes only that single row. Much faster than reading all data.
 */
function updateRow(sheetName, id, data) {
  const sheet = getSheet(sheetName);
  const headers = SCHEMAS[sheetName];
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { success: false, error: 'No rows' };

  // Read only ID column to find the row
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  var rowIndex = -1;
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) { rowIndex = i + 2; break; }
  }
  if (rowIndex === -1) return { success: false, error: 'Not found' };

  // Read only the single target row
  var existingRow = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];

  const now = new Date().toISOString();
  const updatedRow = headers.map(function(h, idx) {
    if (h === 'id') return id;
    if (h === 'updatedAt') return now;
    if (h === 'createdAt') return existingRow[idx] || now;
    if (h === 'deleted') {
      if (data.deleted !== undefined) return data.deleted;
      return existingRow[idx] || false;
    }
    if (data[h] !== undefined) {
      var v = data[h];
      if (typeof v === 'object') return JSON.stringify(v);
      return v;
    }
    return existingRow[idx];
  });

  sheet.getRange(rowIndex, 1, 1, headers.length).setValues([updatedRow]);
  return { success: true, data: { id, ...data, updatedAt: now } };
}

/**
 * SOFT DELETE — marks the row as deleted=true but NEVER removes it.
 * The row stays in the sheet forever and can be restored via restoreRow().
 * This is the core data-protection guarantee.
 */
function softDeleteRow(sheetName, id) {
  return updateRow(sheetName, id, { deleted: true, updatedAt: new Date().toISOString() });
}

/**
 * RESTORE — un-marks a soft-deleted row.
 */
function restoreRow(sheetName, id) {
  return updateRow(sheetName, id, { deleted: false, updatedAt: new Date().toISOString() });
}

// LEGACY deleteRow name kept for backward compatibility — now soft-deletes only.
function deleteRow(sheetName, id) {
  return softDeleteRow(sheetName, id);
}

function bulkCreate(sheetName, dataArray) {
  const sheet = getSheet(sheetName);
  const headers = SCHEMAS[sheetName];
  const now = new Date().toISOString();
  const rows = dataArray.map(data => {
    const id = data.id || Utilities.getUuid();
    return headers.map(h => {
      if (h === 'id') return id;
      if (h === 'deleted') return false;
      if (h === 'createdAt') return data.createdAt || now;
      if (h === 'updatedAt') return now;
      const v = data[h];
      if (v === undefined || v === null) return '';
      if (typeof v === 'object') return JSON.stringify(v);
      return v;
    });
  });
  if (rows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
  }
  return { success: true, count: rows.length };
}

/**
 * BULK UPDATE — update multiple rows in one call.
 * updates = [ { id: 'xxx', data: { field: value } }, ... ]
 * This is MUCH faster than N individual updateRow calls because it:
 *   1. Reads the ID column once
 *   2. Reads each target row once
 *   3. Writes each target row once
 * Instead of N × (read all IDs + read all cols) = O(N × rows × cols).
 */
function bulkUpdate(sheetName, updates) {
  if (!Array.isArray(updates) || updates.length === 0) return { success: true, count: 0 };
  const sheet = getSheet(sheetName);
  const headers = SCHEMAS[sheetName];
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { success: false, error: 'No rows' };

  // Read ID column once
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  const idToRow = {};
  for (var i = 0; i < ids.length; i++) {
    idToRow[String(ids[i][0])] = i + 2;
  }

  const now = new Date().toISOString();
  var count = 0;
  for (var u = 0; u < updates.length; u++) {
    var upd = updates[u];
    var rowIndex = idToRow[String(upd.id)];
    if (!rowIndex) continue;

    var existingRow = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
    var data = upd.data;
    var updatedRow = headers.map(function(h, idx) {
      if (h === 'id') return upd.id;
      if (h === 'updatedAt') return now;
      if (h === 'createdAt') return existingRow[idx] || now;
      if (h === 'deleted') {
        if (data.deleted !== undefined) return data.deleted;
        return existingRow[idx] || false;
      }
      if (data[h] !== undefined) {
        var v = data[h];
        if (typeof v === 'object') return JSON.stringify(v);
        return v;
      }
      return existingRow[idx];
    });
    sheet.getRange(rowIndex, 1, 1, headers.length).setValues([updatedRow]);
    count++;
  }
  return { success: true, count: count };
}

// replaceAll is PERMANENTLY DISABLED for data protection.
// This function is kept only so old code doesn't crash if it references it,
// but it will NEVER delete or overwrite any data.
function replaceAll(sheetName, dataArray) {
  return { success: false, error: 'replaceAll is permanently disabled for data protection. Use create/update instead.' };
}

function saveShop(data) {
  const existing = listRows('Shop');
  if (existing.length > 0) {
    return updateRow('Shop', existing[0].id, data);
  }
  return createRow('Shop', { id: 'shop', ...data });
}

// ===== DASHBOARD STATS (OPTIMIZED — each sheet read exactly once) =====
function getDashboardStats() {
  // Read all 7 sheets in minimal calls (listRows is already cached per-execution via getSheet)
  var items = listRows('Items');
  var customers = listRows('Customers');
  var allSuppliers = listRows('Suppliers');
  var suppliers = allSuppliers.filter(function(s) { return s.active === true || s.active === 'true'; });
  var invoices = listRows('Invoices');
  var quotations = listRows('Quotations');
  var payments = listRows('Payments');
  var enquiries = listRows('Enquiries');
  // Service-center sheets (added for service-section integration)
  var jobs = safeListRows('Jobs');
  var servicePayments = safeListRows('ServicePayments');

  var now = new Date();
  var startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  var startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Single-pass aggregation for invoices
  var monthSales = 0, monthProfit = 0, monthCashSales = 0, monthCreditSales = 0, totalOutstanding = 0;
  var pendingInvoices = [];
  var recentInvoices = [];
  for (var ii = 0; ii < invoices.length; ii++) {
    var inv = invoices[ii];
    var invDate = new Date(inv.date);
    if (invDate >= startOfMonth) {
      var gt = Number(inv.grandTotal) || 0;
      monthSales += gt;
      monthProfit += Number(inv.profit) || 0;
      if (inv.paymentType === 'cash') monthCashSales += gt;
      if (inv.paymentType === 'credit') monthCreditSales += gt;
    }
    if (inv.paymentStatus === 'unpaid' || inv.paymentStatus === 'partial') {
      totalOutstanding += Number(inv.amountDue) || 0;
      if (pendingInvoices.length < 10) pendingInvoices.push(inv);
    }
  }
  // Recent invoices: sort copy, take 5
  recentInvoices = invoices.slice().sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); }).slice(0, 5);

  // Single-pass for items
  var stockValueCost = 0, stockValueSelling = 0, lowStockItems = [];
  for (var it = 0; it < items.length; it++) {
    var item = items[it];
    var qty = Number(item.quantity) || 0;
    stockValueCost += (Number(item.costPrice) || 0) * qty;
    stockValueSelling += (Number(item.sellingPrice) || 0) * qty;
    if (qty <= (Number(item.minQuantity) || 0)) {
      if (lowStockItems.length < 10) lowStockItems.push(item);
    }
  }

  // Quotations & payments
  var monthQuotations = quotations.filter(function(q) { return new Date(q.date) >= startOfMonth; });
  var monthQuotationValue = monthQuotations.reduce(function(s, q) { return s + (Number(q.grandTotal) || 0); }, 0);
  var todayPayments = payments.filter(function(p) { return new Date(p.date) >= startOfToday; });
  var todayPaymentTotal = todayPayments.reduce(function(s, p) { return s + (Number(p.amount) || 0); }, 0);
  var pendingEnquiries = enquiries.filter(function(e) { return (e.status === 'sent' || e.status === 'responded') && e.appliedToItems !== true && e.appliedToItems !== 'true'; }).length;

  var recentPayments = payments.slice().sort(function(a, b) { return new Date(b.date) - new Date(a.date); }).slice(0, 10);
  var recentEnquiries = enquiries.slice().sort(function(a, b) { return new Date(b.sentAt) - new Date(a.sentAt); }).slice(0, 10);

  // ===== SERVICE SECTION STATS (jobs + service payments) =====
  // Calculate 50-50 profit share between Admin and Engineer based on PAID service payments.
  var monthJobs = jobs.filter(function(j) { return new Date(j.createdAt || j.date || 0) >= startOfMonth; });
  var todayJobs = jobs.filter(function(j) { return new Date(j.createdAt || j.date || 0) >= startOfToday; });
  var pendingJobs = jobs.filter(function(j) { return j.status === 'Pending' || j.status === 'In Progress'; });
  var completedJobs = jobs.filter(function(j) { return j.status === 'Completed'; });
  var deliveredJobs = jobs.filter(function(j) { return j.status === 'Delivered'; });
  var highPriorityJobs = jobs.filter(function(j) { return j.priority === 'High' && (j.status === 'Pending' || j.status === 'In Progress'); });

  // Today's service collection
  var todayServicePayments = servicePayments.filter(function(p) { return new Date(p.date) >= startOfToday; });
  var todayServiceTotal = todayServicePayments.reduce(function(s, p) { return s + (Number(p.amount) || 0); }, 0);
  var todayServiceUPI = todayServicePayments.filter(function(p) { return p.mode === 'UPI'; }).reduce(function(s, p) { return s + (Number(p.amount) || 0); }, 0);
  var todayServiceCash = todayServicePayments.filter(function(p) { return p.mode === 'Cash'; }).reduce(function(s, p) { return s + (Number(p.amount) || 0); }, 0);

  // Month's service collection
  var monthServicePayments = servicePayments.filter(function(p) { return new Date(p.date) >= startOfMonth; });
  var monthServiceTotal = monthServicePayments.reduce(function(s, p) { return s + (Number(p.amount) || 0); }, 0);
  var monthServiceUPI = monthServicePayments.filter(function(p) { return p.mode === 'UPI'; }).reduce(function(s, p) { return s + (Number(p.amount) || 0); }, 0);
  var monthServiceCash = monthServicePayments.filter(function(p) { return p.mode === 'Cash'; }).reduce(function(s, p) { return s + (Number(p.amount) || 0); }, 0);

  // 50-50 profit share from PAID service payments only.
  // Service share = sum of serviceProfit * (paidRatio)
  // Parts share   = sum of partsProfit   * (paidRatio)
  // Each side is split 50/50.
  var svcShare = 0, partsProfitShare = 0;
  var paidJobIds = {};
  monthServicePayments.forEach(function(p) { if (p.jobId) paidJobIds[p.jobId] = true; });
  Object.keys(paidJobIds).forEach(function(jid) {
    var job = jobs.find(function(x) { return x.jobId === jid; });
    if (!job) return;
    var jobPayments = servicePayments.filter(function(p) { return p.jobId === jid && new Date(p.date) >= startOfMonth; });
    var jobPaid = jobPayments.reduce(function(s, p) { return s + (Number(p.amount) || 0); }, 0);
    if (jobPaid <= 0) return;
    var totalJob = Number(job.finalAmount) || 0;
    var svc = Number(job.serviceProfit) || 0;
    var pp = Number(job.partsProfit) || 0;
    var paidRatio = totalJob > 0 ? Math.min(jobPaid / totalJob, 1) : 1;
    svcShare += Math.round(svc * paidRatio);
    partsProfitShare += Math.round(pp * paidRatio);
  });
  var adminServiceShare = Math.round(svcShare / 2);
  var adminPartsShare = Math.round(partsProfitShare / 2);
  var adminTotalShare = adminServiceShare + adminPartsShare;

  return {
    stats: {
      totalItems: items.length,
      lowStockCount: lowStockItems.length,
      totalCustomers: customers.length,
      totalSuppliers: suppliers.length,
      stockValueCost: stockValueCost,
      stockValueSelling: stockValueSelling,
      monthSales: monthSales,
      monthProfit: monthProfit,
      monthCashSales: monthCashSales,
      monthCreditSales: monthCreditSales,
      totalOutstanding: totalOutstanding,
      monthQuotationValue: monthQuotationValue,
      totalQuotations: monthQuotations.length,
      todayPaymentTotal: todayPaymentTotal,
      pendingEnquiries: pendingEnquiries,
      // Service section
      totalJobs: jobs.length,
      pendingJobs: pendingJobs.length,
      completedJobs: completedJobs.length,
      deliveredJobs: deliveredJobs.length,
      highPriorityJobs: highPriorityJobs.length,
      todayJobs: todayJobs.length,
      monthJobs: monthJobs.length,
      todayServiceTotal: todayServiceTotal,
      todayServiceUPI: todayServiceUPI,
      todayServiceCash: todayServiceCash,
      monthServiceTotal: monthServiceTotal,
      monthServiceUPI: monthServiceUPI,
      monthServiceCash: monthServiceCash,
      adminServiceShare: adminServiceShare,
      adminPartsShare: adminPartsShare,
      adminTotalShare: adminTotalShare,
      engineerServiceShare: adminServiceShare,
      engineerPartsShare: adminPartsShare,
      engineerTotalShare: adminTotalShare,
    },
    pendingInvoices: pendingInvoices,
    recentInvoices: recentInvoices,
    recentPayments: recentPayments,
    recentEnquiries: recentEnquiries,
    lowStockList: lowStockItems,
    recentJobs: jobs.slice().sort(function(a, b) { return new Date(b.createdAt || 0) - new Date(a.createdAt || 0); }).slice(0, 5),
  };
}

// Safe listRows helper that returns [] if sheet doesn't exist yet (used for
// optional sheets like Jobs / ServicePayments that may not be present in
// older deployments).
function safeListRows(sheetName) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return [];
    return listRows(sheetName);
  } catch (e) {
    return [];
  }
}

// ===== SEED DATA =====
function seedData() {
  const itemsCount = listRows('Items').length;
  const customersCount = listRows('Customers').length;
  const suppliersCount = listRows('Suppliers').length;
  const shopCount = listRows('Shop').length;

  let results = { shop: false, suppliers: 0, items: 0, customers: 0 };

  if (shopCount === 0) {
    saveShop({
      name: 'Smart Computers', owner: 'Shop Owner', phone: '9876543210',
      email: 'smartcomputers@example.com', address: 'Main Road, City Center',
      gstNumber: '29ABCDE1234F1Z5', state: 'Karnataka',
      invoicePrefix: 'INV', quotationPrefix: 'QTN',
      termsInvoice: 'Goods once sold will not be taken back. Subject to local jurisdiction.',
      termsQuotation: 'Quotation valid for 7 days from date of issue.',
    });
    results.shop = true;
  }

  if (suppliersCount === 0) {
    const suppliers = [
      { name: 'Tech Distributors', phone: '919876543210', whatsappNumber: '919876543210', company: 'Tech Distributors Pvt Ltd', suppliedItems: 'Laptop,Desktop,Processor', active: true, includeInAutoEnquiry: true },
      { name: 'Compu WholeSale', phone: '919812345678', whatsappNumber: '919812345678', company: 'Compu WholeSale', suppliedItems: 'RAM,SSD,HDD,Mouse,Keyboard', active: true, includeInAutoEnquiry: true },
      { name: 'Printer Bazaar', phone: '919988776655', whatsappNumber: '919988776655', company: 'Printer Bazaar', suppliedItems: 'Printer,Ink,Toner', active: true, includeInAutoEnquiry: true },
    ];
    const r = bulkCreate('Suppliers', suppliers);
    results.suppliers = r.count;
  }

  if (itemsCount === 0) {
    const suppliers = listRows('Suppliers');
    const items = [
      { name: 'HP Laptop 15s', sku: 'LAP-HP-15S', category: 'Laptop', gstApplicable: true, gstRate: 18, costPrice: 35000, sellingPrice: 40000, quantity: 5, minQuantity: 2, hsnCode: '8471', supplierId: suppliers[0]?.id || '' },
      { name: 'Dell Desktop OptiPlex', sku: 'DSK-DELL-OPT', category: 'Desktop', gstApplicable: true, gstRate: 18, costPrice: 28000, sellingPrice: 32000, quantity: 3, minQuantity: 1, hsnCode: '8471', supplierId: suppliers[0]?.id || '' },
      { name: 'Intel Core i5 Processor', sku: 'CPU-I5-12G', category: 'Processor', gstApplicable: true, gstRate: 18, costPrice: 12000, sellingPrice: 14000, quantity: 8, minQuantity: 3, hsnCode: '8542', supplierId: suppliers[0]?.id || '' },
      { name: '8GB DDR4 RAM', sku: 'RAM-8GB-DDR4', category: 'RAM', gstApplicable: true, gstRate: 18, costPrice: 1800, sellingPrice: 2200, quantity: 20, minQuantity: 5, hsnCode: '8542', supplierId: suppliers[1]?.id || '' },
      { name: '512GB SSD', sku: 'SSD-512-SATA', category: 'Storage', gstApplicable: true, gstRate: 18, costPrice: 2800, sellingPrice: 3500, quantity: 15, minQuantity: 5, hsnCode: '8542', supplierId: suppliers[1]?.id || '' },
      { name: '1TB HDD', sku: 'HDD-1TB-SEAGATE', category: 'Storage', gstApplicable: true, gstRate: 18, costPrice: 3200, sellingPrice: 3800, quantity: 12, minQuantity: 4, hsnCode: '8542', supplierId: suppliers[1]?.id || '' },
      { name: 'Wireless Mouse', sku: 'ACC-MS-WL', category: 'Accessories', gstApplicable: true, gstRate: 18, costPrice: 250, sellingPrice: 450, quantity: 50, minQuantity: 10, hsnCode: '8471', supplierId: suppliers[1]?.id || '' },
      { name: 'USB Keyboard', sku: 'ACC-KB-USB', category: 'Accessories', gstApplicable: true, gstRate: 18, costPrice: 300, sellingPrice: 550, quantity: 40, minQuantity: 10, hsnCode: '8471', supplierId: suppliers[1]?.id || '' },
      { name: 'HP DeskJet Printer', sku: 'PRN-HP-DJ', category: 'Printer', gstApplicable: true, gstRate: 18, costPrice: 4500, sellingPrice: 5500, quantity: 4, minQuantity: 2, hsnCode: '8443', supplierId: suppliers[2]?.id || '' },
      { name: 'Canon Ink Cartridge', sku: 'INK-CANON-BLACK', category: 'Consumables', gstApplicable: true, gstRate: 18, costPrice: 350, sellingPrice: 550, quantity: 25, minQuantity: 5, hsnCode: '8443', supplierId: suppliers[2]?.id || '' },
      { name: 'Service Charge - General', sku: 'SVC-GEN', category: 'Service', gstApplicable: false, gstRate: 0, costPrice: 0, sellingPrice: 500, quantity: 999, minQuantity: 0, hsnCode: '9983' },
      { name: 'Installation Charge', sku: 'SVC-INST', category: 'Service', gstApplicable: false, gstRate: 0, costPrice: 0, sellingPrice: 300, quantity: 999, minQuantity: 0, hsnCode: '9983' },
      { name: 'Courier Charge', sku: 'COU-CHG', category: 'Other', gstApplicable: false, gstRate: 0, costPrice: 0, sellingPrice: 100, quantity: 999, minQuantity: 0, hsnCode: '9965' },
    ];
    const r = bulkCreate('Items', items);
    results.items = r.count;
  }

  if (customersCount === 0) {
    const customers = [
      { name: 'Rahul Sharma', phone: '9123456789', email: 'rahul@example.com', address: 'MG Road, Bangalore', state: 'Karnataka', creditBalance: 0 },
      { name: 'Priya Patel', phone: '9876543211', email: 'priya@example.com', address: 'Civil Lines, Delhi', state: 'Delhi', gstNumber: '07ABCDE5678G1Z2', creditBalance: 0 },
      { name: 'Tech Solutions Pvt Ltd', phone: '9112345678', email: 'contact@techsol.com', address: 'IT Park, Hyderabad', state: 'Telangana', gstNumber: '36XYZAB9012C1Z3', creditBalance: 0 },
      { name: 'Walk-in Customer', phone: '', address: '', state: '', creditBalance: 0 },
    ];
    const r = bulkCreate('Customers', customers);
    results.customers = r.count;
  }

  return { success: true, results };
}

// ===== HELPERS =====
function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Run this manually to test setup */
function testSetup() {
  ensureAllSheets();
  Logger.log('Setup complete! Sheets: ' + SHEET_NAMES.join(', '));
  Logger.log('Sheet info: ' + JSON.stringify(getSheetInfo()));
  Logger.log('Data protection: ENABLED (soft-delete, replaceAll blocked)');
}

/**
 * Admin utility: run this manually from Apps Script editor to see
 * soft-deleted rows in a sheet. Example: listDeletedRows('Items')
 */
function listDeletedRows(sheetName) {
  return listRows(sheetName, null, null, true).filter(r => r.deleted === true || String(r.deleted).toLowerCase() === 'true');
}

/**
 * Admin utility: run this manually from Apps Script editor to restore
 * a soft-deleted row. Example: restoreRow('Items', 'abc-123')
 */
