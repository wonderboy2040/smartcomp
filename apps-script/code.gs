/**
 * Smart Computers - Google Apps Script Backend (PROTECTED EDITION v2.7 - Fixed Sync)
 *
 * FIXES v2.7 (2026-07-14):
 * - TEST/PING actions NEVER touch sheets (fixes "فشل" HTML error page when old code tried to access sheets before permission)
 * - ensureAllSheets now throws clear error if script is NOT bound to a Sheet (standalone script via script.google.com)
 *   -> Fixes silent failure when users create script at script.google.com instead of Extensions → Apps Script
 * - Added getActiveSpreadsheet() null-check with actionable error message
 * - Added safeListRows fallback for optional sheets (already present) + more resilient dashboard
 * - Added version 2.7 marker for diagnostics
 * - Kept soft-delete protection, replaceAll block, data-safe migration
 *
 * DATA PROTECTION (v2.0+):
 *   - DELETE = SOFT-DELETE (deleted=true, never removed)
 *   - REPLACE ALL = BLOCKED
 *   - listRows() filters deleted rows by default
 *   - Schema migration appends columns, never clears data
 *
 * SETUP (MUST follow exactly):
 *   1. Create/open your Google Sheet at https://sheets.new (or your existing sheet)
 *   2. In THAT SHEET: Extensions → Apps Script (IMPORTANT: NOT via script.google.com homepage!)
 *   3. Delete any code, paste ENTIRE file
 *   4. Deploy → New deployment → Web app
 *      - Execute as: Me
 *      - Who has access: Anyone
 *   5. Copy Web App URL (.../exec) → set as APPS_SCRIPT_URL env var in Render/Vercel → redeploy site
 *   6. In site: Settings → Sync → Test Connection → should show Connected
 *
 * UPGRADING from older versions:
 *   Open Sheet → Extensions → Apps Script → paste new file → Save → Deploy → Manage deployments → Edit → Version: New version → Deploy (same URL) → Save → Test Connection
 */

// ===== SHEET SCHEMAS =====
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
  Campaigns: ['id', 'name', 'segment', 'segmentDataJson', 'message', 'status', 'totalRecipients', 'sentCount', 'deliveredCount', 'readCount', 'scheduledAt', 'sentAt', 'createdAt', 'deleted'],
  AMCContracts: ['id', 'contractNumber', 'customerId', 'customerName', 'customerPhone', 'customerAddress', 'devicesCoveredJson', 'startDate', 'endDate', 'fee', 'frequency', 'visitsIncluded', 'visitsUsed', 'lastVisitDate', 'nextVisitDate', 'status', 'notes', 'createdAt', 'updatedAt', 'deleted'],
  Settings: ['id', 'value', 'deleted']
};

const SHEET_NAMES = Object.keys(SCHEMAS);
const SCRIPT_VERSION = '2.7-fixed';

// ===== GET HANDLER =====
function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    const action = params.action || 'status';

    // PING - absolute minimal, no sheet access
    if (action === 'ping') {
      return json({ success: true, message: 'pong', time: new Date().toISOString(), version: SCRIPT_VERSION });
    }

    // TEST - connectivity + version, NO sheet access at all
    if (action === 'test') {
      return json({
        success: true,
        message: 'Connection successful (Protected Edition v2.7)',
        version: SCRIPT_VERSION,
        dataProtection: true,
        sheets: SHEET_NAMES,
        time: new Date().toISOString(),
        hint: 'If test works but list/dashboard fails, ensure script is bound to Sheet (Extensions → Apps Script) and deployed as Anyone.'
      });
    }

    // STATUS - default, no sheet access
    if (action === 'status') {
      return json({ success: true, message: 'Smart Computers API running (Protected v' + SCRIPT_VERSION + ')', sheets: SHEET_NAMES, dataProtection: true, version: SCRIPT_VERSION });
    }

    // All below need sheet access - wrap separately so errors become JSON not HTML
    try {
      ensureAllSheets();
    } catch (sheetErr) {
      // Provide very detailed error to avoid HTML error page like "فشل"
      return json({
        success: false,
        error: 'Sheet access failed: ' + sheetErr.toString() + '. FIX: Make sure this script is BOUND to a Google Sheet (open your Sheet → Extensions → Apps Script, NOT script.google.com homepage). Also ensure you granted permissions: run any function once from editor → Authorize.',
        action: action,
        version: SCRIPT_VERSION
      });
    }

    if (action === 'list') {
      const sheet = params.sheet;
      if (!sheet) return json({ success: false, error: 'Missing sheet param', version: SCRIPT_VERSION });
      if (!SCHEMAS[sheet]) return json({ success: false, error: 'Unknown sheet: ' + sheet + '. Valid: ' + SHEET_NAMES.join(','), version: SCRIPT_VERSION });
      const includeDeleted = params.includeDeleted === 'true';
      const rows = listRows(sheet, params.filter, params.search, includeDeleted);
      return json({ success: true, data: rows, count: rows.length, version: SCRIPT_VERSION });
    }

    if (action === 'get') {
      const sheet = params.sheet;
      const id = params.id;
      if (!sheet || !id) return json({ success: false, error: 'Missing sheet or id', version: SCRIPT_VERSION });
      const row = getRow(sheet, id);
      return row ? json({ success: true, data: row, version: SCRIPT_VERSION }) : json({ success: false, error: 'Not found: ' + id, version: SCRIPT_VERSION });
    }

    if (action === 'shop') {
      const rows = listRows('Shop');
      return json({ success: true, data: rows[0] || null, version: SCRIPT_VERSION });
    }

    if (action === 'dashboard') {
      try {
        return json({ success: true, data: getDashboardStats(), version: SCRIPT_VERSION });
      } catch (dashErr) {
        return json({ success: false, error: 'Dashboard failed: ' + dashErr.toString() + ' Stack: ' + (dashErr.stack || ''), version: SCRIPT_VERSION });
      }
    }

    return json({ success: false, error: 'Unknown action: ' + action + '. Valid: ping,test,status,list,get,shop,dashboard', version: SCRIPT_VERSION });
  } catch (err) {
    // This catch ensures we NEVER return an HTML error page from doGet - always JSON
    return json({ success: false, error: 'Unhandled doGet error: ' + err.toString(), stack: err.stack, version: SCRIPT_VERSION });
  }
}

// ===== POST HANDLER =====
function doPost(e) {
  try {
    let body;
    try {
      body = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return json({ success: false, error: 'Invalid JSON body: ' + parseErr.toString() + '. Ensure Content-Type is text/plain and body is JSON.', version: SCRIPT_VERSION });
    }
    const action = body.action;

    if (!action) return json({ success: false, error: 'Missing action in body', version: SCRIPT_VERSION });

    if (action === 'test') {
      return json({
        success: true,
        message: 'Connection successful (Protected Edition v2.7)',
        version: SCRIPT_VERSION,
        dataProtection: true,
        time: new Date().toISOString()
      });
    }

    if (action === 'ping') {
      return json({ success: true, message: 'pong', time: new Date().toISOString(), version: SCRIPT_VERSION });
    }

    // All below need sheet access
    try {
      ensureAllSheets();
    } catch (sheetErr) {
      return json({
        success: false,
        error: 'Sheet access failed: ' + sheetErr.toString() + '. FIX: Script must be bound to Sheet via Extensions → Apps Script, not standalone.',
        action: action,
        version: SCRIPT_VERSION
      });
    }

    switch (action) {
      case 'create':
        if (!body.sheet) return json({ success: false, error: 'Missing sheet' });
        return json(createRow(body.sheet, body.data));
      case 'update':
        if (!body.sheet || !body.id) return json({ success: false, error: 'Missing sheet or id' });
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
        return json({ success: false, error: 'replace action is permanently disabled for data protection. Use create/update instead.', version: SCRIPT_VERSION });
      case 'saveShop':
        return json(saveShop(body.data));
      case 'seed':
        return json(seedData());
      case 'purge':
        return json({ success: false, error: 'purge action is permanently disabled for data protection.', version: SCRIPT_VERSION });
      default:
        return json({ success: false, error: 'Unknown action: ' + action, version: SCRIPT_VERSION });
    }
  } catch (err) {
    return json({ success: false, error: 'Unhandled doPost error: ' + err.toString(), stack: err.stack, version: SCRIPT_VERSION });
  }
}

// ===== SHEET MANAGEMENT (DATA-SAFE + BOUND CHECK) =====
var _sheetsEnsured = false;

function ensureAllSheets() {
  if (_sheetsEnsured) return;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('No active spreadsheet. This script MUST be bound to a Google Sheet. FIX: Open your Google Sheet → Extensions → Apps Script (do NOT create script at script.google.com). Then paste this code there and deploy.');
  }
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
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('No active spreadsheet in getSheet');
  var sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('Sheet not found: ' + name);
  return sheet;
}

function getSheetInfo() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return [];
  return SHEET_NAMES.map(function(name) {
    var sheet = ss.getSheetByName(name);
    return { name: name, exists: !!sheet, rows: sheet ? sheet.getLastRow() - 1 : 0 };
  });
}

// ===== CRUD =====
function listRows(sheetName, filter, search, includeDeleted) {
  var sheet = getSheet(sheetName);
  var headers = SCHEMAS[sheetName];
  if (!headers) throw new Error('Unknown schema for sheet: ' + sheetName);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  // Defensive: if sheet has fewer columns than headers, read only available then pad
  var lastCol = sheet.getLastColumn();
  var readCols = Math.min(headers.length, lastCol);
  if (readCols < 1) return [];

  var data = sheet.getRange(2, 1, lastRow - 1, readCols).getValues();
  // If we read fewer cols than headers, pad remaining with empty
  var rows = data.map(function(r) {
    var obj = {};
    headers.forEach(function(h, i) {
      var v = (i < r.length) ? r[i] : '';
      obj[h] = (v instanceof Date) ? v.toISOString() : v;
    });
    return obj;
  });

  if (!includeDeleted) {
    rows = rows.filter(function(r) { return r.deleted !== true && String(r.deleted).toLowerCase() !== 'true'; });
  }
  if (filter) {
    var parts = filter.split('=');
    var field = parts[0];
    var value = parts.slice(1).join('=');
    if (field && value !== undefined) {
      rows = rows.filter(function(r) { return String(r[field] || '') === String(value); });
    }
  }
  if (search) {
    var q = search.toLowerCase();
    rows = rows.filter(function(r) {
      return Object.values(r).some(function(v) { return String(v || '').toLowerCase().includes(q); });
    });
  }
  return rows;
}

function getRow(sheetName, id) {
  var sheet = getSheet(sheetName);
  var headers = SCHEMAS[sheetName];
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  var rowIndex = -1;
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) { rowIndex = i + 2; break; }
  }
  if (rowIndex === -1) return null;
  var lastCol = sheet.getLastColumn();
  var readCols = Math.min(headers.length, lastCol);
  var rowData = sheet.getRange(rowIndex, 1, 1, readCols).getValues()[0];
  var obj = {};
  headers.forEach(function(h, idx) {
    var v = (idx < rowData.length) ? rowData[idx] : '';
    obj[h] = (v instanceof Date) ? v.toISOString() : v;
  });
  if (obj.deleted === true || String(obj.deleted).toLowerCase() === 'true') return null;
  return obj;
}

function createRow(sheetName, data) {
  var sheet = getSheet(sheetName);
  var headers = SCHEMAS[sheetName];
  var id = data.id || Utilities.getUuid();
  var now = new Date().toISOString();
  var row = headers.map(function(h) {
    if (h === 'id') return id;
    if (h === 'deleted') return false;
    if (h === 'createdAt') return data.createdAt || now;
    if (h === 'updatedAt') return now;
    var v = data[h];
    if (v === undefined || v === null) return '';
    if (typeof v === 'object') return JSON.stringify(v);
    return v;
  });
  sheet.appendRow(row);
  var ret = { id: id, createdAt: data.createdAt || now, updatedAt: now, deleted: false };
  for (var k in data) ret[k] = data[k];
  ret.id = id;
  return { success: true, data: ret };
}

function updateRow(sheetName, id, data) {
  var sheet = getSheet(sheetName);
  var headers = SCHEMAS[sheetName];
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { success: false, error: 'No rows' };
  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  var rowIndex = -1;
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) { rowIndex = i + 2; break; }
  }
  if (rowIndex === -1) return { success: false, error: 'Not found: ' + id };
  var lastCol = sheet.getLastColumn();
  var readCols = Math.min(headers.length, lastCol);
  var existingRow = sheet.getRange(rowIndex, 1, 1, readCols).getValues()[0];
  var now = new Date().toISOString();
  var updatedRow = headers.map(function(h, idx) {
    if (h === 'id') return id;
    if (h === 'updatedAt') return now;
    if (h === 'createdAt') return (idx < existingRow.length ? existingRow[idx] : '') || now;
    if (h === 'deleted') {
      if (data.deleted !== undefined) return data.deleted;
      return (idx < existingRow.length ? existingRow[idx] : false) || false;
    }
    if (data[h] !== undefined) {
      var v = data[h];
      if (typeof v === 'object') return JSON.stringify(v);
      return v;
    }
    return idx < existingRow.length ? existingRow[idx] : '';
  });
  sheet.getRange(rowIndex, 1, 1, headers.length).setValues([updatedRow]);
  var ret = { id: id, updatedAt: now };
  for (var k in data) ret[k] = data[k];
  return { success: true, data: ret };
}

function softDeleteRow(sheetName, id) {
  return updateRow(sheetName, id, { deleted: true, updatedAt: new Date().toISOString() });
}
function restoreRow(sheetName, id) {
  return updateRow(sheetName, id, { deleted: false, updatedAt: new Date().toISOString() });
}
function deleteRow(sheetName, id) {
  return softDeleteRow(sheetName, id);
}
function bulkCreate(sheetName, dataArray) {
  var sheet = getSheet(sheetName);
  var headers = SCHEMAS[sheetName];
  var now = new Date().toISOString();
  var rows = dataArray.map(function(data) {
    var id = data.id || Utilities.getUuid();
    return headers.map(function(h) {
      if (h === 'id') return id;
      if (h === 'deleted') return false;
      if (h === 'createdAt') return data.createdAt || now;
      if (h === 'updatedAt') return now;
      var v = data[h];
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
function bulkUpdate(sheetName, updates) {
  if (!Array.isArray(updates) || updates.length === 0) return { success: true, count: 0 };
  var sheet = getSheet(sheetName);
  var headers = SCHEMAS[sheetName];
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { success: false, error: 'No rows' };
  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  var idToRow = {};
  for (var i = 0; i < ids.length; i++) {
    idToRow[String(ids[i][0])] = i + 2;
  }
  var now = new Date().toISOString();
  var count = 0;
  for (var u = 0; u < updates.length; u++) {
    var upd = updates[u];
    var rowIndex = idToRow[String(upd.id)];
    if (!rowIndex) continue;
    var lastCol = sheet.getLastColumn();
    var readCols = Math.min(headers.length, lastCol);
    var existingRow = sheet.getRange(rowIndex, 1, 1, readCols).getValues()[0];
    var data = upd.data;
    var updatedRow = headers.map(function(h, idx) {
      if (h === 'id') return upd.id;
      if (h === 'updatedAt') return now;
      if (h === 'createdAt') return (idx < existingRow.length ? existingRow[idx] : '') || now;
      if (h === 'deleted') {
        if (data.deleted !== undefined) return data.deleted;
        return (idx < existingRow.length ? existingRow[idx] : false) || false;
      }
      if (data[h] !== undefined) {
        var v = data[h];
        if (typeof v === 'object') return JSON.stringify(v);
        return v;
      }
      return idx < existingRow.length ? existingRow[idx] : '';
    });
    sheet.getRange(rowIndex, 1, 1, headers.length).setValues([updatedRow]);
    count++;
  }
  return { success: true, count: count };
}
function replaceAll(sheetName, dataArray) {
  return { success: false, error: 'replaceAll is permanently disabled for data protection.' };
}
function saveShop(data) {
  var existing = listRows('Shop');
  if (existing.length > 0) {
    return updateRow('Shop', existing[0].id, data);
  }
  return createRow('Shop', { id: 'shop', ...data });
}
function getDashboardStats() {
  var items = listRows('Items');
  var customers = listRows('Customers');
  var allSuppliers = listRows('Suppliers');
  var suppliers = allSuppliers.filter(function(s) { return s.active === true || s.active === 'true'; });
  var invoices = listRows('Invoices');
  var quotations = listRows('Quotations');
  var payments = listRows('Payments');
  var enquiries = listRows('Enquiries');
  var jobs = safeListRows('Jobs');
  var servicePayments = safeListRows('ServicePayments');

  var now = new Date();
  var startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  var startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

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
  recentInvoices = invoices.slice().sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); }).slice(0, 5);

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

  var monthQuotations = quotations.filter(function(q) { return new Date(q.date) >= startOfMonth; });
  var monthQuotationValue = monthQuotations.reduce(function(s, q) { return s + (Number(q.grandTotal) || 0); }, 0);
  var todayPayments = payments.filter(function(p) { return new Date(p.date) >= startOfToday; });
  var todayPaymentTotal = todayPayments.reduce(function(s, p) { return s + (Number(p.amount) || 0); }, 0);
  var pendingEnquiries = enquiries.filter(function(e) { return (e.status === 'sent' || e.status === 'responded') && e.appliedToItems !== true && e.appliedToItems !== 'true'; }).length;

  var recentPayments = payments.slice().sort(function(a, b) { return new Date(b.date) - new Date(a.date); }).slice(0, 10);
  var recentEnquiries = enquiries.slice().sort(function(a, b) { return new Date(b.sentAt) - new Date(a.sentAt); }).slice(0, 10);

  var monthJobs = jobs.filter(function(j) { return new Date(j.createdAt || j.date || 0) >= startOfMonth; });
  var todayJobs = jobs.filter(function(j) { return new Date(j.createdAt || j.date || 0) >= startOfToday; });
  var pendingJobs = jobs.filter(function(j) { return j.status === 'Pending' || j.status === 'In Progress'; });
  var completedJobs = jobs.filter(function(j) { return j.status === 'Completed'; });
  var deliveredJobs = jobs.filter(function(j) { return j.status === 'Delivered'; });
  var highPriorityJobs = jobs.filter(function(j) { return j.priority === 'High' && (j.status === 'Pending' || j.status === 'In Progress'); });

  var todayServicePayments = servicePayments.filter(function(p) { return new Date(p.date) >= startOfToday; });
  var todayServiceTotal = todayServicePayments.reduce(function(s, p) { return s + (Number(p.amount) || 0); }, 0);
  var todayServiceUPI = todayServicePayments.filter(function(p) { return p.mode === 'UPI'; }).reduce(function(s, p) { return s + (Number(p.amount) || 0); }, 0);
  var todayServiceCash = todayServicePayments.filter(function(p) { return p.mode === 'Cash'; }).reduce(function(s, p) { return s + (Number(p.amount) || 0); }, 0);

  var monthServicePayments = servicePayments.filter(function(p) { return new Date(p.date) >= startOfMonth; });
  var monthServiceTotal = monthServicePayments.reduce(function(s, p) { return s + (Number(p.amount) || 0); }, 0);
  var monthServiceUPI = monthServicePayments.filter(function(p) { return p.mode === 'UPI'; }).reduce(function(s, p) { return s + (Number(p.amount) || 0); }, 0);
  var monthServiceCash = monthServicePayments.filter(function(p) { return p.mode === 'Cash'; }).reduce(function(s, p) { return s + (Number(p.amount) || 0); }, 0);

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
      engineerTotalShare: adminTotalShare
    },
    pendingInvoices: pendingInvoices,
    recentInvoices: recentInvoices,
    recentPayments: recentPayments,
    recentEnquiries: recentEnquiries,
    lowStockList: lowStockItems,
    recentJobs: jobs.slice().sort(function(a, b) { return new Date(b.createdAt || 0) - new Date(a.createdAt || 0); }).slice(0, 5)
  };
}
function safeListRows(sheetName) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) return [];
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return [];
    return listRows(sheetName);
  } catch (e) {
    return [];
  }
}
function seedData() {
  var itemsCount = listRows('Items').length;
  var customersCount = listRows('Customers').length;
  var suppliersCount = listRows('Suppliers').length;
  var shopCount = listRows('Shop').length;
  var results = { shop: false, suppliers: 0, items: 0, customers: 0 };
  if (shopCount === 0) {
    saveShop({
      name: 'Smart Computers', owner: 'Shop Owner', phone: '9876543210',
      email: 'smartcomputers@example.com', address: 'Main Road, City Center',
      gstNumber: '29ABCDE1234F1Z5', state: 'Karnataka',
      invoicePrefix: 'INV', quotationPrefix: 'QTN',
      termsInvoice: 'Goods once sold will not be taken back. Subject to local jurisdiction.',
      termsQuotation: 'Quotation valid for 7 days from date of issue.'
    });
    results.shop = true;
  }
  if (suppliersCount === 0) {
    var suppliers = [
      { name: 'Tech Distributors', phone: '919876543210', whatsappNumber: '919876543210', company: 'Tech Distributors Pvt Ltd', suppliedItems: 'Laptop,Desktop,Processor', active: true, includeInAutoEnquiry: true },
      { name: 'Compu WholeSale', phone: '919812345678', whatsappNumber: '919812345678', company: 'Compu WholeSale', suppliedItems: 'RAM,SSD,HDD,Mouse,Keyboard', active: true, includeInAutoEnquiry: true },
      { name: 'Printer Bazaar', phone: '919988776655', whatsappNumber: '919988776655', company: 'Printer Bazaar', suppliedItems: 'Printer,Ink,Toner', active: true, includeInAutoEnquiry: true }
    ];
    var r = bulkCreate('Suppliers', suppliers);
    results.suppliers = r.count;
  }
  if (itemsCount === 0) {
    var suppliersList = listRows('Suppliers');
    var items = [
      { name: 'HP Laptop 15s', sku: 'LAP-HP-15S', category: 'Laptop', gstApplicable: true, gstRate: 18, costPrice: 35000, sellingPrice: 40000, quantity: 5, minQuantity: 2, hsnCode: '8471', supplierId: suppliersList[0] ? suppliersList[0].id : '' },
      { name: 'Dell Desktop OptiPlex', sku: 'DSK-DELL-OPT', category: 'Desktop', gstApplicable: true, gstRate: 18, costPrice: 28000, sellingPrice: 32000, quantity: 3, minQuantity: 1, hsnCode: '8471', supplierId: suppliersList[0] ? suppliersList[0].id : '' },
      { name: 'Intel Core i5 Processor', sku: 'CPU-I5-12G', category: 'Processor', gstApplicable: true, gstRate: 18, costPrice: 12000, sellingPrice: 14000, quantity: 8, minQuantity: 3, hsnCode: '8542', supplierId: suppliersList[0] ? suppliersList[0].id : '' },
      { name: '8GB DDR4 RAM', sku: 'RAM-8GB-DDR4', category: 'RAM', gstApplicable: true, gstRate: 18, costPrice: 1800, sellingPrice: 2200, quantity: 20, minQuantity: 5, hsnCode: '8542', supplierId: suppliersList[1] ? suppliersList[1].id : '' },
      { name: '512GB SSD', sku: 'SSD-512-SATA', category: 'Storage', gstApplicable: true, gstRate: 18, costPrice: 2800, sellingPrice: 3500, quantity: 15, minQuantity: 5, hsnCode: '8542', supplierId: suppliersList[1] ? suppliersList[1].id : '' }
    ];
    var r2 = bulkCreate('Items', items);
    results.items = r2.count;
  }
  if (customersCount === 0) {
    var customers = [
      { name: 'Rahul Sharma', phone: '9123456789', email: 'rahul@example.com', address: 'MG Road, Bangalore', state: 'Karnataka', creditBalance: 0 },
      { name: 'Walk-in Customer', phone: '', address: '', state: '', creditBalance: 0 }
    ];
    var r3 = bulkCreate('Customers', customers);
    results.customers = r3.count;
  }
  return { success: true, results: results, version: SCRIPT_VERSION };
}
function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function testSetup() {
  ensureAllSheets();
  Logger.log('Setup v' + SCRIPT_VERSION + ' complete! Sheets: ' + SHEET_NAMES.join(', '));
  Logger.log('Sheet info: ' + JSON.stringify(getSheetInfo()));
}
function listDeletedRows(sheetName) {
  return listRows(sheetName, null, null, true).filter(function(r) { return r.deleted === true || String(r.deleted).toLowerCase() === 'true'; });
}
