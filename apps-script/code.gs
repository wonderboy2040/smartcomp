/**
 * Smart Computers - Google Apps Script Backend
 * 
 * This is the COMPLETE backend for the Smart Computers panel.
 * All data is stored in Google Sheets. No other database needed.
 * 
 * SETUP:
 * 1. Create new Google Sheet at https://sheets.new
 * 2. Extensions → Apps Script
 * 3. Paste this entire file
 * 4. Deploy → New deployment → Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Copy the Web App URL (ends with /exec)
 * 6. Set this URL as APPS_SCRIPT_URL env var in your Next.js deployment
 */

// ===== SHEET SCHEMAS =====
const SCHEMAS = {
  Shop: ['id', 'name', 'owner', 'phone', 'email', 'address', 'gstNumber', 'state', 'invoicePrefix', 'quotationPrefix', 'termsInvoice', 'termsQuotation', 'createdAt', 'updatedAt'],
  Items: ['id', 'name', 'sku', 'category', 'description', 'gstApplicable', 'gstRate', 'costPrice', 'sellingPrice', 'quantity', 'minQuantity', 'unit', 'hsnCode', 'supplierId', 'createdAt', 'updatedAt'],
  Customers: ['id', 'name', 'phone', 'email', 'address', 'gstNumber', 'state', 'creditBalance', 'createdAt', 'updatedAt'],
  Suppliers: ['id', 'name', 'phone', 'whatsappNumber', 'email', 'company', 'address', 'suppliedItems', 'active', 'includeInAutoEnquiry', 'createdAt', 'updatedAt'],
  Invoices: ['id', 'number', 'customerId', 'customerName', 'customerPhone', 'customerGstin', 'date', 'itemsJson', 'subtotal', 'gstAmount', 'courierCharges', 'otherCharges', 'discount', 'grandTotal', 'totalCost', 'profit', 'paymentType', 'paymentStatus', 'amountPaid', 'amountDue', 'notes', 'createdAt'],
  Quotations: ['id', 'number', 'customerId', 'customerName', 'customerPhone', 'customerGstin', 'date', 'validTill', 'itemsJson', 'subtotal', 'gstAmount', 'courierCharges', 'otherCharges', 'discount', 'grandTotal', 'notes', 'status', 'convertedToInvoiceId', 'createdAt'],
  Payments: ['id', 'invoiceId', 'invoiceNumber', 'customerName', 'amount', 'type', 'date', 'notes', 'reference', 'createdAt'],
  Enquiries: ['id', 'supplierId', 'supplierName', 'supplierPhone', 'itemsJson', 'message', 'status', 'sentAt', 'respondedAt', 'response', 'ratesJson', 'appliedToItems', 'isAuto', 'createdAt'],
  Settings: ['id', 'value']
};

const SHEET_NAMES = Object.keys(SCHEMAS);

// ===== GET HANDLER =====
function doGet(e) {
  try {
    const params = e.parameter || {};
    const action = params.action || 'status';

    if (action === 'status') {
      return json({ success: true, message: 'Smart Computers API running', sheets: SHEET_NAMES });
    }

    ensureAllSheets();

    if (action === 'list') {
      const sheet = params.sheet;
      if (!sheet) return json({ success: false, error: 'Missing sheet' });
      const rows = listRows(sheet, params.filter, params.search);
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
    return json({ success: false, error: err.toString(), stack: err.stack });
  }
}

// ===== POST HANDLER =====
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;

    ensureAllSheets();

    switch (action) {
      case 'create':
        return json(createRow(body.sheet, body.data));
      case 'update':
        return json(updateRow(body.sheet, body.id, body.data));
      case 'delete':
        return json(deleteRow(body.sheet, body.id));
      case 'bulkCreate':
        return json(bulkCreate(body.sheet, body.data));
      case 'replace':
        return json(replaceAll(body.sheet, body.data));
      case 'saveShop':
        return json(saveShop(body.data));
      case 'test':
        return json({ success: true, message: 'Connection successful', sheets: getSheetInfo() });
      case 'seed':
        return json(seedData());
      default:
        return json({ success: false, error: 'Unknown action: ' + action });
    }
  } catch (err) {
    return json({ success: false, error: err.toString(), stack: err.stack });
  }
}

// ===== SHEET MANAGEMENT =====
function ensureAllSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  for (const name of SHEET_NAMES) {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
    }
    const headers = SCHEMAS[name];
    const existing = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0];
    if (existing[0] !== headers[0] || existing.length < headers.length) {
      sheet.clear();
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#1e293b').setFontColor('#ffffff');
      sheet.setFrozenRows(1);
    }
  }
}

function getSheet(name) {
  ensureAllSheets();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
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
function listRows(sheetName, filter, search) {
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

function getRow(sheetName, id) {
  const rows = listRows(sheetName);
  return rows.find(r => r.id === id) || null;
}

function createRow(sheetName, data) {
  const sheet = getSheet(sheetName);
  const headers = SCHEMAS[sheetName];
  const id = data.id || Utilities.getUuid();
  const now = new Date().toISOString();

  const row = headers.map(h => {
    if (h === 'id') return id;
    if (h === 'createdAt') return data.createdAt || now;
    if (h === 'updatedAt') return now;
    const v = data[h];
    if (v === undefined || v === null) return '';
    if (typeof v === 'object') return JSON.stringify(v);
    return v;
  });

  sheet.appendRow(row);
  return { success: true, data: { id, ...data, createdAt: data.createdAt || now, updatedAt: now } };
}

function updateRow(sheetName, id, data) {
  const sheet = getSheet(sheetName);
  const headers = SCHEMAS[sheetName];
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { success: false, error: 'No rows' };

  const data2d = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  let rowIndex = -1;
  for (let i = 0; i < data2d.length; i++) {
    if (String(data2d[i][0]) === String(id)) { rowIndex = i + 2; break; }
  }
  if (rowIndex === -1) return { success: false, error: 'Not found' };

  const now = new Date().toISOString();
  const updatedRow = headers.map(h => {
    if (h === 'id') return id;
    if (h === 'updatedAt') return now;
    if (h === 'createdAt') return data2d[rowIndex - 2][headers.indexOf('createdAt')] || now;
    if (data[h] !== undefined) {
      const v = data[h];
      if (typeof v === 'object') return JSON.stringify(v);
      return v;
    }
    // Keep existing
    const existingIdx = headers.indexOf(h);
    return data2d[rowIndex - 2][existingIdx];
  });

  sheet.getRange(rowIndex, 1, 1, headers.length).setValues([updatedRow]);
  return { success: true, data: { id, ...data, updatedAt: now } };
}

function deleteRow(sheetName, id) {
  const sheet = getSheet(sheetName);
  const headers = SCHEMAS[sheetName];
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { success: false, error: 'No rows' };

  const data2d = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  let rowIndex = -1;
  for (let i = 0; i < data2d.length; i++) {
    if (String(data2d[i][0]) === String(id)) { rowIndex = i + 2; break; }
  }
  if (rowIndex === -1) return { success: false, error: 'Not found' };

  sheet.deleteRow(rowIndex);
  return { success: true };
}

function bulkCreate(sheetName, dataArray) {
  const sheet = getSheet(sheetName);
  const headers = SCHEMAS[sheetName];
  const now = new Date().toISOString();
  const rows = dataArray.map(data => {
    const id = data.id || Utilities.getUuid();
    return headers.map(h => {
      if (h === 'id') return id;
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

function replaceAll(sheetName, dataArray) {
  const sheet = getSheet(sheetName);
  const headers = SCHEMAS[sheetName];
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.deleteRows(2, lastRow - 1);
  
  if (dataArray && dataArray.length > 0) {
    return bulkCreate(sheetName, dataArray);
  }
  return { success: true, count: 0 };
}

function saveShop(data) {
  const existing = listRows('Shop');
  if (existing.length > 0) {
    return updateRow('Shop', existing[0].id, data);
  }
  return createRow('Shop', { id: 'shop', ...data });
}

// ===== DASHBOARD STATS =====
function getDashboardStats() {
  const items = listRows('Items');
  const customers = listRows('Customers');
  const suppliers = listRows('Suppliers').filter(s => s.active === true || s.active === 'true');
  const invoices = listRows('Invoices');
  const quotations = listRows('Quotations');
  const payments = listRows('Payments');
  const enquiries = listRows('Enquiries');

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const monthInvoices = invoices.filter(i => new Date(i.date) >= startOfMonth);
  const monthQuotations = quotations.filter(q => new Date(q.date) >= startOfMonth);
  const todayPayments = payments.filter(p => new Date(p.date) >= startOfToday);
  const pendingInvoices = invoices.filter(i => i.paymentStatus === 'unpaid' || i.paymentStatus === 'partial');

  const stockValueCost = items.reduce((s, i) => s + (Number(i.costPrice) || 0) * (Number(i.quantity) || 0), 0);
  const stockValueSelling = items.reduce((s, i) => s + (Number(i.sellingPrice) || 0) * (Number(i.quantity) || 0), 0);
  const lowStockItems = items.filter(i => (Number(i.quantity) || 0) <= (Number(i.minQuantity) || 0));

  const monthSales = monthInvoices.reduce((s, i) => s + (Number(i.grandTotal) || 0), 0);
  const monthProfit = monthInvoices.reduce((s, i) => s + (Number(i.profit) || 0), 0);
  const monthCashSales = monthInvoices.filter(i => i.paymentType === 'cash').reduce((s, i) => s + (Number(i.grandTotal) || 0), 0);
  const monthCreditSales = monthInvoices.filter(i => i.paymentType === 'credit').reduce((s, i) => s + (Number(i.grandTotal) || 0), 0);
  const totalOutstanding = pendingInvoices.reduce((s, i) => s + (Number(i.amountDue) || 0), 0);
  const monthQuotationValue = monthQuotations.reduce((s, q) => s + (Number(q.grandTotal) || 0), 0);
  const todayPaymentTotal = todayPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const pendingEnquiries = enquiries.filter(e => (e.status === 'sent' || e.status === 'responded') && e.appliedToItems !== true && e.appliedToItems !== 'true').length;

  const recentInvoices = invoices.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
  const recentPayments = payments.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);
  const recentEnquiries = enquiries.sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt)).slice(0, 10);

  return {
    stats: {
      totalItems: items.length,
      lowStockCount: lowStockItems.length,
      totalCustomers: customers.length,
      totalSuppliers: suppliers.length,
      stockValueCost,
      stockValueSelling,
      monthSales,
      monthProfit,
      monthCashSales,
      monthCreditSales,
      totalOutstanding,
      monthQuotationValue,
      totalQuotations: monthQuotations.length,
      todayPaymentTotal,
      pendingEnquiries,
    },
    pendingInvoices: pendingInvoices.slice(0, 10),
    recentInvoices,
    recentPayments,
    recentEnquiries,
    lowStockList: lowStockItems.slice(0, 10),
  };
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
}
