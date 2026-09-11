import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const filePath = resolve(root, 'preview', 'index.html');
let html = readFileSync(filePath, 'utf8');

// 1. Remove quick owner chip from login screen
html = html.replace(/<div style="text-align:center;">\s*<div class="quick-owner-chip"[^>]*>[\s\S]*?<\/div>\s*<\/div>/g, '');

// 2. Add contextual "+" buttons in Inventory, Vendors, Purchases headers
html = html.replace(
  '<div class="bar-back" onclick="openImportSheet()" title="Import from Excel">⇪</div>',
  '<div class="bar-back" onclick="openAddProductModal()" title="Add Item" style="margin-right:6px;background:var(--indigo-tint);color:var(--indigo);font-weight:700;">+</div><div class="bar-back" onclick="openImportSheet()" title="Import from Excel">⇪</div>'
);

html = html.replace(
  '<div><div class="bar-title">Vendors</div><div class="bar-sub" id="vendCount">12 vendors · 2 bills need review</div></div>',
  '<div><div class="bar-title">Vendors</div><div class="bar-sub" id="vendCount">12 vendors · 2 bills need review</div></div><div class="bar-back" onclick="openAddVendorModal()" title="Add Vendor" style="background:var(--indigo-tint);color:var(--indigo);font-weight:700;">+</div>'
);

html = html.replace(
  '<div class="bar-back" onclick="openWaSheet()" title="Paste vendor order">📋</div>',
  '<div class="bar-back" onclick="openAddPurchaseModal()" title="Add Purchase" style="margin-right:6px;background:var(--indigo-tint);color:var(--indigo);font-weight:700;">+</div><div class="bar-back" onclick="openWaSheet()" title="Paste vendor order">📋</div>'
);

// 3. Update show function with history & back support
const oldShow = "function show(id){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));document.getElementById(id).classList.add('active');}";
const newShow = `function show(id, pushHistory = true){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  const target = document.getElementById(id);
  if(target) target.classList.add('active');
  if(pushHistory && id !== 'login') {
    try { history.pushState({screen: id}, '', '#' + id); } catch(e){}
  }
}
window.addEventListener('popstate', (e) => {
  const openSheets = document.querySelectorAll('.sheet.show, .sheet-scrim.show');
  if(openSheets.length > 0) {
    document.querySelectorAll('.sheet').forEach(s => s.classList.remove('show'));
    document.querySelectorAll('.sheet-scrim').forEach(s => s.classList.remove('show'));
    return;
  }
  if(e.state && e.state.screen) {
    show(e.state.screen, false);
  } else {
    show('cc', false);
  }
});`;

if (html.includes(oldShow)) {
  html = html.replace(oldShow, newShow);
} else {
  html = html.replace(/function show\(id\)\{[^}]+\}/, newShow);
}

// 4. Add modal sheets for Add Product, Add Vendor, Add Purchase
const newSheets = `
  <!-- ================= ADD PRODUCT SHEET ================= -->
  <div class="sheet-scrim" id="addProductScrim" onclick="closeAddProductModal()"></div>
  <div class="sheet" id="addProductSheet">
    <div class="sheet-handle"></div>
    <div class="sheet-head"><div class="bar-title">Add inventory item</div><div class="bar-sub">New product entry in local database</div></div>
    <div class="sheet-body">
      <div class="field" style="background:var(--paper-raised);border-color:var(--rule);"><label>PRODUCT NAME</label><input id="apName" style="color:var(--ink);" placeholder="e.g. A4 Copy Paper Ream" /></div>
      <div class="field" style="background:var(--paper-raised);border-color:var(--rule);"><label>ALIAS / CODE</label><input id="apAlias" style="color:var(--ink);" placeholder="e.g. PAP-01" /></div>
      <div class="field" style="background:var(--paper-raised);border-color:var(--rule);"><label>BRAND</label><input id="apBrand" style="color:var(--ink);" placeholder="e.g. JK Copier" /></div>
      <div class="field" style="background:var(--paper-raised);border-color:var(--rule);"><label>CATEGORY</label><input id="apCategory" style="color:var(--ink);" placeholder="e.g. Paper" /></div>
      <div style="display:flex;gap:10px;">
        <div class="field" style="flex:1;background:var(--paper-raised);border-color:var(--rule);"><label>STOCK</label><input id="apStock" type="number" style="color:var(--ink);" placeholder="50" /></div>
        <div class="field" style="flex:1;background:var(--paper-raised);border-color:var(--rule);"><label>MIN STOCK</label><input id="apMin" type="number" style="color:var(--ink);" placeholder="10" /></div>
      </div>
      <div style="display:flex;gap:10px;">
        <div class="field" style="flex:1;background:var(--paper-raised);border-color:var(--rule);"><label>PURCHASE RATE (₹)</label><input id="apBuy" type="number" style="color:var(--ink);" placeholder="200" /></div>
        <div class="field" style="flex:1;background:var(--paper-raised);border-color:var(--rule);"><label>SELL RATE (₹)</label><input id="apSell" type="number" style="color:var(--ink);" placeholder="250" /></div>
      </div>
    </div>
    <div class="sheet-foot">
      <button class="sheet-btn cancel" onclick="closeAddProductModal()">Cancel</button>
      <button class="sheet-btn confirm" onclick="saveNewProduct()">Save item</button>
    </div>
  </div>

  <!-- ================= ADD VENDOR SHEET ================= -->
  <div class="sheet-scrim" id="addVendorScrim" onclick="closeAddVendorModal()"></div>
  <div class="sheet" id="addVendorSheet">
    <div class="sheet-handle"></div>
    <div class="sheet-head"><div class="bar-title">Add new vendor</div><div class="bar-sub">Supplier and credit terms</div></div>
    <div class="sheet-body">
      <div class="field" style="background:var(--paper-raised);border-color:var(--rule);"><label>VENDOR NAME</label><input id="avName" style="color:var(--ink);" placeholder="e.g. Sharma Paper Mart" /></div>
      <div class="field" style="background:var(--paper-raised);border-color:var(--rule);"><label>TERMS & LOCATION</label><input id="avTerms" style="color:var(--ink);" placeholder="e.g. 15-day credit · Chawri Bazar" /></div>
    </div>
    <div class="sheet-foot">
      <button class="sheet-btn cancel" onclick="closeAddVendorModal()">Cancel</button>
      <button class="sheet-btn confirm" onclick="saveNewVendor()">Save vendor</button>
    </div>
  </div>

  <!-- ================= ADD PURCHASE SHEET ================= -->
  <div class="sheet-scrim" id="addPurchaseScrim" onclick="closeAddPurchaseModal()"></div>
  <div class="sheet" id="addPurchaseSheet">
    <div class="sheet-handle"></div>
    <div class="sheet-head"><div class="bar-title">New purchase order</div><div class="bar-sub">Record incoming stock bill</div></div>
    <div class="sheet-body">
      <div class="field" style="background:var(--paper-raised);border-color:var(--rule);"><label>VENDOR NAME</label><input id="apoVendor" style="color:var(--ink);" placeholder="e.g. Ashok Pen Wale" /></div>
      <div class="field" style="background:var(--paper-raised);border-color:var(--rule);"><label>ITEM / DESCRIPTION</label><input id="apoItem" style="color:var(--ink);" placeholder="e.g. DOMS Pens (Box)" /></div>
      <div style="display:flex;gap:10px;">
        <div class="field" style="flex:1;background:var(--paper-raised);border-color:var(--rule);"><label>QTY</label><input id="apoQty" type="number" style="color:var(--ink);" placeholder="20" /></div>
        <div class="field" style="flex:1;background:var(--paper-raised);border-color:var(--rule);"><label>TOTAL AMT (₹)</label><input id="apoAmt" type="number" style="color:var(--ink);" placeholder="1200" /></div>
      </div>
    </div>
    <div class="sheet-foot">
      <button class="sheet-btn cancel" onclick="closeAddPurchaseModal()">Cancel</button>
      <button class="sheet-btn confirm" onclick="saveNewPurchase()">Create order</button>
    </div>
  </div>
`;

html = html.replace('  <!-- ================= SYNC STATUS SHEET ================= -->', newSheets + '\n  <!-- ================= SYNC STATUS SHEET ================= -->');

// 5. Add modal JS functions and pull-to-refresh logic
const modalJs = `
function openAddProductModal(){ document.getElementById('addProductScrim').classList.add('show'); document.getElementById('addProductSheet').classList.add('show'); }
function closeAddProductModal(){ document.getElementById('addProductScrim').classList.remove('show'); document.getElementById('addProductSheet').classList.remove('show'); }
async function saveNewProduct(){
  const name = document.getElementById('apName').value.trim();
  const alias = document.getElementById('apAlias').value.trim() || ('ITEM-'+Math.floor(Math.random()*900+100));
  const brand = document.getElementById('apBrand').value.trim() || 'General';
  const category = document.getElementById('apCategory').value.trim() || 'Stationery';
  const stock = parseInt(document.getElementById('apStock').value) || 10;
  const min = parseInt(document.getElementById('apMin').value) || 5;
  const purchaseRate = parseFloat(document.getElementById('apBuy').value) || 10;
  const sellRate = parseFloat(document.getElementById('apSell').value) || 15;
  if(!name){ toast('Enter product name'); return; }
  const p = { id: 'p_'+Date.now(), alias, name, brand, line: null, category, stock, min, purchaseRate, sellRate, icon: '📦' };
  PRODUCTS.unshift(p);
  await saveKeyRaw('gsh:products', PRODUCTS);
  closeAddProductModal();
  filterInventory();
  toast('Product added successfully');
}

function openAddVendorModal(){ document.getElementById('addVendorScrim').classList.add('show'); document.getElementById('addVendorSheet').classList.add('show'); }
function closeAddVendorModal(){ document.getElementById('addVendorScrim').classList.remove('show'); document.getElementById('addVendorSheet').classList.remove('show'); }
async function saveNewVendor(){
  const name = document.getElementById('avName').value.trim();
  const terms = document.getElementById('avTerms').value.trim() || '15-day credit';
  if(!name){ toast('Enter vendor name'); return; }
  const v = { id: 'v_'+Date.now(), name, initial: name.charAt(0).toUpperCase(), terms, bills: 0, reviewCount: 0, monthSpend: 0 };
  VENDORS.unshift(v);
  await saveKeyRaw('gsh:vendors', VENDORS);
  closeAddVendorModal();
  renderVendors();
  toast('Vendor added successfully');
}

function openAddPurchaseModal(){ document.getElementById('addPurchaseScrim').classList.add('show'); document.getElementById('addPurchaseSheet').classList.add('show'); }
function closeAddPurchaseModal(){ document.getElementById('addPurchaseScrim').classList.remove('show'); document.getElementById('addPurchaseSheet').classList.remove('show'); }
async function saveNewPurchase(){
  const vendor = document.getElementById('apoVendor').value.trim() || 'General Supplier';
  const item = document.getElementById('apoItem').value.trim() || 'Stationery stock';
  const qty = parseInt(document.getElementById('apoQty').value) || 10;
  const amt = parseFloat(document.getElementById('apoAmt').value) || 500;
  const po = {
    id: 'po_' + Date.now(),
    vendor,
    date: BUSINESS_DATE,
    status: 'REVIEW',
    source: 'Manual entry',
    lines: [{ name: item, qty, rate: Math.round(amt/qty), amt }],
    total: amt,
    paid: amt,
    linkedBill: true
  };
  PURCHASES.unshift(po);
  await saveKeyRaw('gsh:purchases', PURCHASES);
  closeAddPurchaseModal();
  renderPurchases();
  toast('Purchase order created');
}

let touchStartY = 0;
function handlePullToRefreshStart(e){
  if(window.scrollY === 0) {
    touchStartY = e.touches[0].clientY;
  }
}
function handlePullToRefreshMove(e){
  if(touchStartY && e.touches[0].clientY - touchStartY > 90) {
    touchStartY = 0;
    toast('Checking for updates & refreshing...');
    checkOtaUpdate(true);
    setTimeout(() => { renderCC(); filterInventory(); renderVendors(); renderPurchases(); }, 600);
  }
}
function handlePullToRefreshEnd(){
  touchStartY = 0;
}
`;

html = html.replace('/* ---------- BOOTSTRAP: load everything from window.storage', modalJs + '\n/* ---------- BOOTSTRAP: load everything from window.storage');

writeFileSync(filePath, html);
console.log('Update script executed successfully.');
