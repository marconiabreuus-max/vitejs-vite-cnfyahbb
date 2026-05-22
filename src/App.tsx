import { useState, useEffect } from "react";

// ═══════════════════════════════════════════════════════
// MP BUSINESS STRATEGY LLC — ERP SYSTEM
// Dados salvam AUTOMATICAMENTE no navegador E na nuvem
// ═══════════════════════════════════════════════════════

// ── SUPABASE (nuvem) ──────────────────────────────────
const SB_URL = "https://fpjapzovpxwdvrsgosxe.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwamFwem92cHh3ZHZyc2dvc3hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MTA0NjQsImV4cCI6MjA5NDI4NjQ2NH0.xiO-OBQbh9gn8ZZbQn4jyAA3JBUyAySqNi2Y4IRhedk";

async function cloudLoad() {
  try {
    const r = await fetch(SB_URL + "/rest/v1/inventory?id=eq.mp_erp_data&select=data", {
      headers: { "apikey": SB_KEY, "Authorization": "Bearer " + SB_KEY }
    });
    const rows = await r.json();
    if (rows && rows[0] && Array.isArray(rows[0].data) && rows[0].data.length > 0) {
      return rows[0].data;
    }
    return null;
  } catch { return null; }
}

async function cloudSave(items) {
  try {
    await fetch(SB_URL + "/rest/v1/inventory", {
      method: "POST",
      headers: {
        "apikey": SB_KEY,
        "Authorization": "Bearer " + SB_KEY,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
      },
      body: JSON.stringify([{ id: "mp_erp_data", data: items }])
    });
  } catch (e) { console.warn("Cloud save failed:", e); }
}

// ── LOCALSTORAGE (navegador) ──────────────────────────
// Salva direto no navegador — persiste ao atualizar a página
function localSave(items) {
  try { localStorage.setItem("mp_erp_data", JSON.stringify(items)); } catch {}
}
function localLoad() {
  try {
    const d = localStorage.getItem("mp_erp_data");
    return d ? JSON.parse(d) : null;
  } catch { return null; }
}

// ── CONSTANTES ────────────────────────────────────────
const TAX = 0.285;
const RACKS = 7;
const SHELF_NAMES = { 1: "Shelf 1 (top)", 2: "Shelf 2", 3: "Shelf 3", 4: "Shelf 4", 5: "Floor" };
const PLATFORMS = {
  ebay:    { label: "eBay",          fee: 0.1325 },
  amazon:  { label: "Amazon",        fee: 0.15 },
  shopify: { label: "Shopify",       fee: 0.029 },
  fb:      { label: "Facebook Mkt",  fee: 0.05 },
  direct:  { label: "Direct / Cash", fee: 0 },
};
const CATS = ["Industrial Automation","Servo Motors","HMI / Panels","Circuit Breakers","Power Supplies","Safety Components","Network Equipment","Electronics","Other"];
const COND = { ns: "New Sealed", no: "New Open Box", rf: "Refurbished", uw: "Used / Working", uu: "Used / Untested" };
const ST = {
  purchased: { l: "Purchased", c: "#78716c", bg: "#f5f5f4", icon: "🛒" },
  received:  { l: "In Stock",  c: "#2563eb", bg: "#dbeafe", icon: "📦" },
  listed:    { l: "Listed",    c: "#d97706", bg: "#fef3c7", icon: "📢" },
  sold:      { l: "Sold",      c: "#16a34a", bg: "#dcfce7", icon: "✅" },
  removed:   { l: "Removed",   c: "#dc2626", bg: "#fee2e2", icon: "🗑" },
};

// ── FUNÇÕES AUXILIARES ────────────────────────────────
function loc(item) {
  if (!item.rack || !item.shelf) return "—";
  return item.pos ? item.rack + "-" + item.shelf + "-" + item.pos : item.rack + "-" + item.shelf;
}
function locFull(item) {
  if (!item.rack || !item.shelf) return "No location";
  return "Rack " + item.rack + " · " + (SHELF_NAMES[item.shelf] || "Shelf " + item.shelf) + (item.pos ? " · Pos " + item.pos : "");
}
function money(v) {
  if (v == null || isNaN(v)) return "—";
  return (v < 0 ? "-$" : "$") + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function pct(v) { return (v == null || isNaN(v)) ? "—" : v.toFixed(1) + "%"; }
function today() { return new Date().toISOString().slice(0, 10); }
function genId(items) {
  const nums = items.map(i => parseInt((i.id || "").replace("MP-", ""), 10)).filter(n => !isNaN(n));
  return "MP-" + String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, "0");
}
function calcPL(item) {
  const cu = parseFloat(item.costUnit) || 0;
  const lp = parseFloat(item.listP) || 0;
  const fee = lp * (PLATFORMS[item.channel]?.fee || 0);
  const eG = lp - fee - cu;
  const eT = eG > 0 ? eG * TAX : 0;
  const eN = eG - eT;
  const eM = cu > 0 ? (eN / cu) * 100 : 0;
  let rev = 0, pfee = 0, gross = 0, taxAmt = 0, net = 0;
  (item.sales || []).forEach(s => {
    const r = (parseFloat(s.price) || 0) + (parseFloat(s.shipCharged) || 0);
    const pf = r * (PLATFORMS[s.channel || item.channel]?.fee || 0);
    const g = r - pf - (parseFloat(s.shipCost) || 0) - (parseFloat(s.packCost) || 0) - cu;
    const t = g > 0 ? g * TAX : 0;
    rev += r; pfee += pf; gross += g; taxAmt += t; net += (g - t);
  });
  return { cu, lp, fee, eG, eT, eN, eM, rev, pfee, gross, taxAmt, net, totalCostIn: parseFloat(item.costTotal) || 0 };
}

// ── DADOS INICIAIS (Invoice #1410243) ─────────────────
function buildSeed() {
  return [
    {id:"MP-001",name:"SIEMENS 6FC5303-1AF10-8AA0 Operator Panel CNC Industrial Control HMI",sku:"",cat:"HMI / Panels",cond:"no",qty:4,qtyInStock:4,qtySold:0,supplier:"Michigan Industrial Auctions",invoice:"1410243-312676-1",lots:"2,22,38,89",bought:"2026-04-22",received:"2026-04-29",listed:"2026-05-07",rack:1,shelf:2,pos:4,notes:"",channel:"ebay",listP:699.0,listUrl:"https://www.ebay.com/itm/318266136225",costTotal:783.28,costUnit:195.82,status:"listed",sales:[],ebayItemId:"318266136225"},
    {id:"MP-002",name:"Panduit VS-AVT-C08-L10 VeriSafe Absense of Voltage Tester Industrial-each",sku:"",cat:"Safety Components",cond:"no",qty:15,qtyInStock:15,qtySold:0,supplier:"Michigan Industrial Auctions",invoice:"1410243-312676-1",lots:"7,51,69,96,153,173,222",bought:"2026-04-22",received:"2026-04-29",listed:"2026-05-07",rack:1,shelf:1,pos:3,notes:"",channel:"ebay",listP:89.9,listUrl:"https://www.ebay.com/itm/318267048201",costTotal:210.6,costUnit:14.04,status:"listed",sales:[],ebayItemId:"318267048201"},
    {id:"MP-003",name:"SOLA SCP 102D24X-C02 Dual Output Power Supply 24V 3.8A Industrial PSU",sku:"",cat:"Power Supplies",cond:"no",qty:4,qtyInStock:3,qtySold:1,supplier:"Michigan Industrial Auctions",invoice:"1410243-312676-1",lots:"8,27,71,156,184",bought:"2026-04-22",received:"2026-04-29",listed:"2026-05-07",rack:1,shelf:3,pos:3,notes:"",channel:"ebay",listP:129.9,listUrl:"https://www.ebay.com/itm/318267056735",costTotal:210.6,costUnit:52.65,status:"listed",sales:[{"date": "2026-05-11", "channel": "ebay", "price": 129.9, "shipCharged": 0, "shipCost": 0, "packCost": 0}],ebayItemId:"318267056735"},
    {id:"MP-004",name:"Marathon EPBCP84 Power Distribution Block, 760A, 1000V, AC/DC, CU9, 4AWG",sku:"",cat:"Power Supplies",cond:"no",qty:24,qtyInStock:24,qtySold:0,supplier:"Michigan Industrial Auctions",invoice:"1410243-312676-1",lots:"9,28,44,72,122,142,164,185",bought:"2026-04-22",received:"2026-04-29",listed:"2026-05-07",rack:1,shelf:2,pos:4,notes:"",channel:"ebay",listP:319.0,listUrl:"https://www.ebay.com/itm/318267125657",costTotal:1033.68,costUnit:43.07,status:"listed",sales:[],ebayItemId:"318267125657"},
    {id:"MP-005",name:"Siemens 1FK7034-2AK74-1SH0 SIMOTICS S Servo Motor NEW",sku:"",cat:"Servo Motors",cond:"ns",qty:6,qtyInStock:6,qtySold:0,supplier:"Michigan Industrial Auctions",invoice:"1410243-312676-1",lots:"10,110,160,210,288",bought:"2026-04-22",received:"2026-04-29",listed:"2026-05-07",rack:1,shelf:1,pos:1,notes:"",channel:"ebay",listP:1499.0,listUrl:"https://www.ebay.com/itm/318267253764",costTotal:2519.28,costUnit:419.88,status:"listed",sales:[],ebayItemId:"318267253764"},
    {id:"MP-006",name:"SICK DUSTHUNTER SP30 DHSP30-T2VATNNNNNXXS NEW",sku:"",cat:"Industrial Automation",cond:"no",qty:1,qtyInStock:1,qtySold:0,supplier:"Michigan Industrial Auctions",invoice:"1410243-312676-1",lots:"12,53,54,61,81,128,148",bought:"2026-04-22",received:"2026-04-29",listed:"2026-05-07",rack:1,shelf:1,pos:3,notes:"",channel:"ebay",listP:2490.0,listUrl:"https://www.ebay.com/itm/318267332147",costTotal:0,costUnit:0,status:"listed",sales:[],ebayItemId:"318267332147"},
    {id:"MP-007",name:"Siemens 3VA5260-6ED31-0AA0 Circuit Breaker 60A 800V New Open Box",sku:"",cat:"Circuit Breakers",cond:"no",qty:1,qtyInStock:1,qtySold:0,supplier:"Michigan Industrial Auctions",invoice:"1410243-312676-1",lots:"11,29,45,73,99,123,186,219,239,345",bought:"2026-04-22",received:"2026-04-29",listed:"2026-05-11",rack:1,shelf:2,pos:4,notes:"",channel:"ebay",listP:899.0,listUrl:"https://www.ebay.com/itm/318286660770",costTotal:251.68,costUnit:251.68,status:"listed",sales:[],ebayItemId:"318286660770"},
    {id:"MP-008",name:"Siemens 3VA5260-6ED31-0AA0 Circuit Breaker 60A 800V New Open Box",sku:"",cat:"Circuit Breakers",cond:"no",qty:9,qtyInStock:9,qtySold:0,supplier:"Michigan Industrial Auctions",invoice:"1410243-312676-1",lots:"11,29,45,73,99,123,186,219,239,345",bought:"2026-04-22",received:"2026-04-29",listed:"2026-05-11",rack:1,shelf:3,pos:1,notes:"",channel:"ebay",listP:919.0,listUrl:"https://www.ebay.com/itm/318286670296",costTotal:2265.12,costUnit:251.68,status:"listed",sales:[],ebayItemId:"318286670296"},
    {id:"MP-009",name:"HIRSCHMANN Octopus 28 Port Ethernet Switch OS20-002800T5T5T5-TBBY999GMSE3S",sku:"",cat:"Network Equipment",cond:"no",qty:4,qtyInStock:4,qtySold:0,supplier:"Michigan Industrial Auctions",invoice:"1410243-312676-1",lots:"31,46,74,124",bought:"2026-04-22",received:"2026-04-29",listed:"2026-05-11",rack:1,shelf:3,pos:4,notes:"",channel:"ebay",listP:599.0,listUrl:"https://www.ebay.com/itm/318286746219",costTotal:712.67,costUnit:178.17,status:"listed",sales:[],ebayItemId:"318286746219"},
    {id:"MP-010",name:"Siemens 6AV2124-0MC01-0AX0 6AV2 124-0MC01-0AX0 SIMATIC TP 1200 New Open box",sku:"",cat:"HMI / Panels",cond:"no",qty:4,qtyInStock:3,qtySold:1,supplier:"Michigan Industrial Auctions",invoice:"1410243-312676-1",lots:"41,93,117,138",bought:"2026-04-22",received:"2026-04-29",listed:"2026-05-11",rack:1,shelf:2,pos:1,notes:"",channel:"ebay",listP:749.0,listUrl:"https://www.ebay.com/itm/318286933441",costTotal:1348.24,costUnit:337.06,status:"listed",sales:[{"date": "2026-05-11", "channel": "ebay", "price": 749.0, "shipCharged": 0, "shipCost": 0, "packCost": 0}],ebayItemId:"318286933441"},
    {id:"MP-011",name:"Siemens 6SL3120-2TE15-0AD0 SINAMICS S120 Double Motor Module New Open Box",sku:"",cat:"Industrial Automation",cond:"no",qty:16,qtyInStock:16,qtySold:0,supplier:"Michigan Industrial Auctions",invoice:"1410243-312676-1",lots:"48,65,114,126,145,179,188,236",bought:"2026-04-22",received:"2026-04-29",listed:"2026-05-11",rack:1,shelf:5,pos:4,notes:"",channel:"ebay",listP:499.0,listUrl:"https://www.ebay.com/itm/318286954082",costTotal:2536.0,costUnit:158.5,status:"listed",sales:[],ebayItemId:"318286954082"},
    {id:"MP-012",name:"ANYBUS AB7658-F Profinet IO Slave CANopen Slave Industrial Module",sku:"",cat:"Network Equipment",cond:"no",qty:4,qtyInStock:4,qtySold:0,supplier:"Michigan Industrial Auctions",invoice:"1410243-312676-1",lots:"52,79",bought:"2026-04-22",received:"2026-04-29",listed:"2026-05-11",rack:1,shelf:3,pos:3,notes:"",channel:"ebay",listP:499.0,listUrl:"https://www.ebay.com/itm/318287022018",costTotal:365.96,costUnit:91.49,status:"listed",sales:[],ebayItemId:"318287022018"},
    {id:"MP-013",name:"Siemens 6SL3120-1TE23-0AD0 SINAMICS Single Motor Module New Open Box",sku:"",cat:"Industrial Automation",cond:"no",qty:6,qtyInStock:6,qtySold:0,supplier:"Michigan Industrial Auctions",invoice:"1410243-312676-1",lots:"326,339,351,366,382,391",bought:"2026-04-22",received:"2026-04-29",listed:"2026-05-11",rack:1,shelf:5,pos:3,notes:"",channel:"ebay",listP:899.0,listUrl:"https://www.ebay.com/itm/318287120769",costTotal:2369.1,costUnit:394.85,status:"listed",sales:[],ebayItemId:"318287120769"},
    {id:"MP-014",name:"STS Brandschutzsysteme LMK1 Fire Protection Control Unit New Open Box",sku:"",cat:"Industrial Automation",cond:"no",qty:2,qtyInStock:2,qtySold:0,supplier:"",invoice:"",lots:"",bought:"",received:"",listed:"2026-05-12",rack:1,shelf:3,pos:3,notes:"",channel:"ebay",listP:289.0,listUrl:"https://www.ebay.com/itm/318291629048",costTotal:0,costUnit:0,status:"listed",sales:[],ebayItemId:"318291629048"},
    {id:"MP-015",name:"Camfil CPU201E Electric Control ECS Air Pollution Control Panel New O Box",sku:"",cat:"Industrial Automation",cond:"no",qty:6,qtyInStock:6,qtySold:0,supplier:"",invoice:"",lots:"",bought:"",received:"",listed:"2026-05-12",rack:1,shelf:3,pos:3,notes:"",channel:"ebay",listP:289.0,listUrl:"https://www.ebay.com/itm/318291789581",costTotal:0,costUnit:0,status:"listed",sales:[],ebayItemId:"318291789581"},
    {id:"MP-016",name:"Siemens 6SL3040-1NC00-0AA0 NX10.3 SINAMICS Control Unit New Open Box",sku:"",cat:"Industrial Automation",cond:"no",qty:3,qtyInStock:3,qtySold:0,supplier:"Michigan Industrial Auctions",invoice:"1410243-312676-1",lots:"198,277,378",bought:"2026-04-22",received:"2026-04-29",listed:"2026-05-12",rack:1,shelf:5,pos:4,notes:"",channel:"ebay",listP:819.0,listUrl:"https://www.ebay.com/itm/318292198942",costTotal:1072.17,costUnit:357.39,status:"listed",sales:[],ebayItemId:"318292198942"},
    {id:"MP-017",name:"Banner PVA225P6EQ PVA225P6RQ Safety Light Curtain Emitter Receiver",sku:"",cat:"Safety Components",cond:"no",qty:1,qtyInStock:1,qtySold:0,supplier:"",invoice:"",lots:"",bought:"",received:"",listed:"2026-05-12",rack:1,shelf:1,pos:3,notes:"",channel:"ebay",listP:499.0,listUrl:"https://www.ebay.com/itm/318292210458",costTotal:0,costUnit:0,status:"listed",sales:[],ebayItemId:"318292210458"},
    {id:"MP-018",name:"Siemens 6SL3100-1DE22-0AA1 SINAMICS Control Supply Module New Open Box",sku:"",cat:"Industrial Automation",cond:"no",qty:1,qtyInStock:1,qtySold:0,supplier:"Michigan Industrial Auctions",invoice:"1410243-312676-1",lots:"292",bought:"2026-04-22",received:"2026-04-29",listed:"2026-05-12",rack:1,shelf:5,pos:3,notes:"",channel:"ebay",listP:619.0,listUrl:"https://www.ebay.com/itm/318292352607",costTotal:166.93,costUnit:166.93,status:"listed",sales:[],ebayItemId:"318292352607"},
    {id:"MP-019",name:"Siemens 6SL3040-1NB00-0AA0 SINAMICS Control Unit New Open Box",sku:"",cat:"Industrial Automation",cond:"no",qty:4,qtyInStock:4,qtySold:0,supplier:"Michigan Industrial Auctions",invoice:"1410243-312676-1",lots:"136,221,259",bought:"2026-04-22",received:"2026-04-29",listed:"2026-05-12",rack:1,shelf:5,pos:3,notes:"",channel:"ebay",listP:899.0,listUrl:"https://www.ebay.com/itm/318292846782",costTotal:1198.48,costUnit:299.62,status:"listed",sales:[],ebayItemId:"318292846782"},
    {id:"MP-020",name:"Siemens 6SL3120-1TE21-8AD0 SINAMICS Single Motor Module New Open Box",sku:"",cat:"Industrial Automation",cond:"no",qty:2,qtyInStock:2,qtySold:0,supplier:"Michigan Industrial Auctions",invoice:"1410243-312676-1",lots:"372,388",bought:"2026-04-22",received:"2026-04-29",listed:"2026-05-12",rack:1,shelf:5,pos:3,notes:"",channel:"ebay",listP:819.0,listUrl:"https://www.ebay.com/itm/318292987311",costTotal:776.88,costUnit:388.44,status:"listed",sales:[],ebayItemId:"318292987311"},
    {id:"MP-021",name:"Siemens 1FK7086-4CF71-1SH0 SIMOTICS S Servo Motor New Open Box",sku:"",cat:"Servo Motors",cond:"no",qty:2,qtyInStock:2,qtySold:0,supplier:"Michigan Industrial Auctions",invoice:"1410243-312676-1",lots:"150,170",bought:"2026-04-22",received:"2026-04-29",listed:"2026-05-12",rack:1,shelf:5,pos:1,notes:"",channel:"ebay",listP:3290.0,listUrl:"https://www.ebay.com/itm/318293129759",costTotal:616.34,costUnit:308.17,status:"listed",sales:[],ebayItemId:"318293129759"},
    {id:"MP-022",name:"Siemens 3VA5210-6ED31-0AA0 Circuit Breaker 100A 800V New Open Box",sku:"",cat:"Circuit Breakers",cond:"no",qty:3,qtyInStock:3,qtySold:0,supplier:"Michigan Industrial Auctions",invoice:"1410243-312676-1",lots:"143,165,204",bought:"2026-04-22",received:"2026-04-29",listed:"2026-05-12",rack:1,shelf:3,pos:4,notes:"",channel:"ebay",listP:959.0,listUrl:"https://www.ebay.com/itm/318293197591",costTotal:642.03,costUnit:214.01,status:"listed",sales:[],ebayItemId:"318293197591"},
    {id:"MP-023",name:"Siemens 1FT7044-1AF71-1CH1 SIMOTICS S Servo Motor New Open Box",sku:"",cat:"Servo Motors",cond:"no",qty:1,qtyInStock:1,qtySold:0,supplier:"Michigan Industrial Auctions",invoice:"1410243-312676-1",lots:"140",bought:"2026-04-22",received:"2026-04-29",listed:"2026-05-12",rack:1,shelf:5,pos:1,notes:"",channel:"ebay",listP:2690.0,listUrl:"https://www.ebay.com/itm/318293246709",costTotal:455.84,costUnit:455.84,status:"listed",sales:[],ebayItemId:"318293246709"},
    {id:"MP-024",name:"Siemens 1FK7064-4CH71-1SH0 SIMOTICS S Servo Motor Seller Refurbished",sku:"",cat:"Servo Motors",cond:"rf",qty:2,qtyInStock:2,qtySold:0,supplier:"Michigan Industrial Auctions",invoice:"1410243-312676-1",lots:"120,200",bought:"2026-04-22",received:"2026-04-29",listed:"2026-05-13",rack:1,shelf:5,pos:1,notes:"",channel:"ebay",listP:1490.0,listUrl:"https://www.ebay.com/itm/318299195912",costTotal:513.62,costUnit:256.81,status:"listed",sales:[],ebayItemId:"318299195912"},
    {id:"MP-025",name:"Siemens 3VA5195-6ED31-0AA0 95A Circuit Breaker + 3VA9137-0EK11",sku:"",cat:"Circuit Breakers",cond:"no",qty:16,qtyInStock:16,qtySold:0,supplier:"Michigan Industrial Auctions",invoice:"1410243-312676-1",lots:"82,116,129,161,199,261,272,284,297,311,325,338",bought:"2026-04-22",received:"2026-04-29",listed:"2026-05-13",rack:1,shelf:3,pos:1,notes:"",channel:"ebay",listP:259.0,listUrl:"https://www.ebay.com/itm/318299283270",costTotal:719.04,costUnit:44.94,status:"listed",sales:[],ebayItemId:"318299283270"},
    {id:"MP-026",name:"Siemens 3RV2742-5BD10 Motor Starter Protector Circuit Breaker NewOpenBox",sku:"",cat:"Circuit Breakers",cond:"no",qty:11,qtyInStock:11,qtySold:0,supplier:"Michigan Industrial Auctions",invoice:"1410243-312676-1",lots:"125,144,167,187,223,241,299,365",bought:"2026-04-22",received:"2026-04-29",listed:"2026-05-13",rack:1,shelf:2,pos:1,notes:"",channel:"ebay",listP:95.9,listUrl:"https://www.ebay.com/itm/318299376845",costTotal:317.79,costUnit:28.89,status:"listed",sales:[],ebayItemId:"318299376845"},
    {id:"MP-027",name:"SIEMENS 3RV2742-5ED10, SIRUS CIRCUIT BREAKER New Open Box",sku:"",cat:"Circuit Breakers",cond:"no",qty:13,qtyInStock:13,qtySold:0,supplier:"Michigan Industrial Auctions",invoice:"1410243-312676-1",lots:"125,144,167,187,223,241,299,365",bought:"2026-04-22",received:"2026-04-29",listed:"2026-05-13",rack:1,shelf:4,pos:4,notes:"",channel:"ebay",listP:45.9,listUrl:"https://www.ebay.com/itm/318299523139",costTotal:375.57,costUnit:28.89,status:"listed",sales:[],ebayItemId:"318299523139"},
    {id:"MP-028",name:"Siemens 6EP3333-7LB00-0AX0 SITOP Power Supply Module New Open Box - Each",sku:"",cat:"Power Supplies",cond:"no",qty:6,qtyInStock:6,qtySold:0,supplier:"Michigan Industrial Auctions",invoice:"1410243-312676-1",lots:"8,27,71,156,184",bought:"2026-04-22",received:"2026-04-29",listed:"2026-05-14",rack:1,shelf:3,pos:1,notes:"",channel:"ebay",listP:87.9,listUrl:"https://www.ebay.com/itm/318302328333",costTotal:315.9,costUnit:52.65,status:"listed",sales:[],ebayItemId:"318302328333"},
    {id:"MP-029",name:"Emerson SolaHD SCP 102D24X-C02 Industrial Power Supply New Without Box",sku:"",cat:"Power Supplies",cond:"no",qty:1,qtyInStock:1,qtySold:0,supplier:"Michigan Industrial Auctions",invoice:"1410243-312676-1",lots:"8,27,71,156,184",bought:"2026-04-22",received:"2026-04-29",listed:"2026-05-14",rack:1,shelf:3,pos:1,notes:"",channel:"ebay",listP:389.0,listUrl:"https://www.ebay.com/itm/318302375785",costTotal:52.65,costUnit:52.65,status:"listed",sales:[],ebayItemId:"318302375785"},
    {id:"MP-030",name:"Siemens 6EP1433-2BA20 SITOP Power Supply Module New Open Box",sku:"",cat:"Power Supplies",cond:"no",qty:2,qtyInStock:2,qtySold:0,supplier:"",invoice:"",lots:"",bought:"",received:"",listed:"2026-05-14",rack:1,shelf:3,pos:1,notes:"",channel:"ebay",listP:55.9,listUrl:"https://www.ebay.com/itm/318302387144",costTotal:0,costUnit:0,status:"listed",sales:[],ebayItemId:"318302387144"},
    {id:"MP-031",name:"Siemens 6EP1334-3BA10 SITOP Power Supply Module New Open Box",sku:"",cat:"Power Supplies",cond:"no",qty:2,qtyInStock:2,qtySold:0,supplier:"",invoice:"",lots:"",bought:"",received:"",listed:"2026-05-14",rack:1,shelf:3,pos:1,notes:"",channel:"ebay",listP:59.9,listUrl:"https://www.ebay.com/itm/318302391323",costTotal:0,costUnit:0,status:"listed",sales:[],ebayItemId:"318302391323"},
    {id:"MP-032",name:"MurrElektronik 85690 3-Phase Power Supply 24-28V 5A DC New Open Box",sku:"",cat:"Power Supplies",cond:"no",qty:2,qtyInStock:2,qtySold:0,supplier:"",invoice:"",lots:"",bought:"",received:"",listed:"2026-05-14",rack:1,shelf:3,pos:1,notes:"",channel:"ebay",listP:299.0,listUrl:"https://www.ebay.com/itm/318302545217",costTotal:0,costUnit:0,status:"listed",sales:[],ebayItemId:"318302545217"},
    {id:"MP-033",name:"SICK WL9L-3P2432 Photoelectric Sensor New Open Box - Each -",sku:"",cat:"Electronics",cond:"no",qty:10,qtyInStock:10,qtySold:0,supplier:"Michigan Industrial Auctions",invoice:"1410243-312676-1",lots:"12,53,54,61,81,128,148",bought:"2026-04-22",received:"2026-04-29",listed:"2026-05-14",rack:1,shelf:3,pos:1,notes:"",channel:"ebay",listP:74.9,listUrl:"https://www.ebay.com/itm/318302553230",costTotal:0,costUnit:0,status:"listed",sales:[],ebayItemId:"318302553230"},
    {id:"MP-034",name:"Siemens 3RV2711-1DD10 Motor Starter Protector Circuit Breaker New Open Box",sku:"",cat:"Circuit Breakers",cond:"no",qty:2,qtyInStock:2,qtySold:0,supplier:"",invoice:"",lots:"",bought:"",received:"",listed:"2026-05-14",rack:1,shelf:2,pos:2,notes:"",channel:"ebay",listP:25.9,listUrl:"https://www.ebay.com/itm/318302814404",costTotal:0,costUnit:0,status:"listed",sales:[],ebayItemId:"318302814404"},
    {id:"MP-035",name:"Siemens 3RV2917-4A Auxiliary Switch Block New Open Box",sku:"",cat:"Circuit Breakers",cond:"no",qty:1,qtyInStock:1,qtySold:0,supplier:"",invoice:"",lots:"",bought:"",received:"",listed:"2026-05-14",rack:1,shelf:2,pos:2,notes:"",channel:"ebay",listP:16.9,listUrl:"https://www.ebay.com/itm/318302837329",costTotal:0,costUnit:0,status:"listed",sales:[],ebayItemId:"318302837329"},
    {id:"MP-036",name:"Siemens 6EP1961-2BA61 SITOP Select Power Module New Open Box",sku:"",cat:"Power Supplies",cond:"no",qty:1,qtyInStock:1,qtySold:0,supplier:"",invoice:"",lots:"",bought:"",received:"",listed:"2026-05-14",rack:1,shelf:2,pos:2,notes:"",channel:"ebay",listP:169.0,listUrl:"https://www.ebay.com/itm/318302855009",costTotal:0,costUnit:0,status:"listed",sales:[],ebayItemId:"318302855009"},
    {id:"MP-037",name:"Siemens 6FC5348-0AA30-3AA0 SINUMERIK Dual Fan Module New Open Box",sku:"",cat:"Industrial Automation",cond:"no",qty:1,qtyInStock:1,qtySold:0,supplier:"",invoice:"",lots:"",bought:"",received:"",listed:"2026-05-14",rack:1,shelf:2,pos:2,notes:"",channel:"ebay",listP:299.0,listUrl:"https://www.ebay.com/itm/318302860088",costTotal:0,costUnit:0,status:"listed",sales:[],ebayItemId:"318302860088"},
    {id:"MP-038",name:"Siemens 6ES7512-1SK01-0AB0 SIMATIC DP CPU 1512SP F-1 PN New Open Box",sku:"",cat:"Industrial Automation",cond:"no",qty:1,qtyInStock:1,qtySold:0,supplier:"Michigan Industrial Auctions",invoice:"1410243-312676-1",lots:"151",bought:"2026-04-22",received:"2026-04-29",listed:"2026-05-14",rack:1,shelf:2,pos:2,notes:"",channel:"ebay",listP:599.0,listUrl:"https://www.ebay.com/itm/318302966692",costTotal:295.33,costUnit:295.33,status:"listed",sales:[],ebayItemId:"318302966692"},
    {id:"MP-039",name:"Siemens 6ES7954-8LF03-0AA0 SIMATIC S7 24MB Memory Card New Open Box",sku:"",cat:"Industrial Automation",cond:"no",qty:1,qtyInStock:1,qtySold:0,supplier:"",invoice:"",lots:"",bought:"",received:"",listed:"2026-05-14",rack:1,shelf:2,pos:2,notes:"",channel:"ebay",listP:129.9,listUrl:"https://www.ebay.com/itm/318302998385",costTotal:0,costUnit:0,status:"listed",sales:[],ebayItemId:"318302998385"},
    {id:"MP-040",name:"Siemens 3RV2711-1DD10 Motor Starter Protector Circuit Breaker New Open Box",sku:"",cat:"Circuit Breakers",cond:"no",qty:2,qtyInStock:2,qtySold:0,supplier:"",invoice:"",lots:"",bought:"",received:"",listed:"2026-05-15",rack:1,shelf:2,pos:2,notes:"",channel:"ebay",listP:25.9,listUrl:"https://www.ebay.com/itm/318307956403",costTotal:0,costUnit:0,status:"listed",sales:[],ebayItemId:"318307956403"},
    {id:"MP-041",name:"Siemens sentron Sicherungshalter 3NW753-30HG ( 3NW7 5330HG ) New open box.",sku:"",cat:"Industrial Automation",cond:"no",qty:2,qtyInStock:2,qtySold:0,supplier:"",invoice:"",lots:"",bought:"",received:"",listed:"2026-05-15",rack:1,shelf:2,pos:2,notes:"",channel:"ebay",listP:15.9,listUrl:"https://www.ebay.com/itm/318307957009",costTotal:0,costUnit:0,status:"listed",sales:[],ebayItemId:"318307957009"},
    {id:"MP-042",name:"Siemens 3NW1040-0HG 4A Time Delay Fuse Class CC Current Limiting NEW O BOX",sku:"",cat:"Industrial Automation",cond:"no",qty:6,qtyInStock:6,qtySold:0,supplier:"",invoice:"",lots:"",bought:"",received:"",listed:"2026-05-15",rack:1,shelf:2,pos:2,notes:"",channel:"ebay",listP:6.9,listUrl:"https://www.ebay.com/itm/318307957431",costTotal:0,costUnit:0,status:"listed",sales:[],ebayItemId:"318307957431"},
    {id:"MP-043",name:"Siemens 3SK1211-1BB40 SIRIUS Safety Relay Output Expansion 4NO 1NC 24VDC",sku:"",cat:"Safety Components",cond:"no",qty:2,qtyInStock:2,qtySold:0,supplier:"",invoice:"",lots:"",bought:"",received:"",listed:"2026-05-15",rack:1,shelf:2,pos:2,notes:"",channel:"ebay",listP:9.5,listUrl:"https://www.ebay.com/itm/318307957874",costTotal:0,costUnit:0,status:"listed",sales:[],ebayItemId:"318307957874"},
    {id:"MP-044",name:"Siemens 3RT2016-1HB42 SIRIUS Contactor w 3RT2916-1BB00 New Open Box",sku:"",cat:"Industrial Automation",cond:"no",qty:4,qtyInStock:4,qtySold:0,supplier:"",invoice:"",lots:"",bought:"",received:"",listed:"2026-05-15",rack:1,shelf:2,pos:2,notes:"",channel:"ebay",listP:38.9,listUrl:"https://www.ebay.com/itm/318307958418",costTotal:0,costUnit:0,status:"listed",sales:[],ebayItemId:"318307958418"},
    {id:"MP-045",name:"Siemens 3RT2015-1BB41 SIRIUS Power Contactor New Open Box",sku:"",cat:"Industrial Automation",cond:"no",qty:1,qtyInStock:1,qtySold:0,supplier:"",invoice:"",lots:"",bought:"",received:"",listed:"2026-05-15",rack:1,shelf:2,pos:2,notes:"",channel:"ebay",listP:15.9,listUrl:"https://www.ebay.com/itm/318307958825",costTotal:0,costUnit:0,status:"listed",sales:[],ebayItemId:"318307958825"},
    {id:"MP-046",name:"Siemens 3RV2711-1JD10 SIRIUS Motor Starter Protector New Open Box",sku:"",cat:"Circuit Breakers",cond:"no",qty:1,qtyInStock:1,qtySold:0,supplier:"",invoice:"",lots:"",bought:"",received:"",listed:"2026-05-15",rack:1,shelf:2,pos:2,notes:"",channel:"ebay",listP:25.9,listUrl:"https://www.ebay.com/itm/318307959527",costTotal:0,costUnit:0,status:"listed",sales:[],ebayItemId:"318307959527"},
    {id:"MP-047",name:"Siemens 3RV2011-0AA10 SIRIUS Motor Starter Protector New Open Box",sku:"",cat:"Circuit Breakers",cond:"no",qty:2,qtyInStock:2,qtySold:0,supplier:"",invoice:"",lots:"",bought:"",received:"",listed:"2026-05-15",rack:1,shelf:2,pos:2,notes:"",channel:"ebay",listP:55.9,listUrl:"https://www.ebay.com/itm/318307959986",costTotal:0,costUnit:0,status:"listed",sales:[],ebayItemId:"318307959986"},
    {id:"MP-048",name:"Siemens 3RV2917-1E SIRIUS 3-Phase Busbar Right Infeed New Open Box",sku:"",cat:"Circuit Breakers",cond:"no",qty:1,qtyInStock:1,qtySold:0,supplier:"",invoice:"",lots:"",bought:"",received:"",listed:"2026-05-15",rack:1,shelf:2,pos:2,notes:"",channel:"ebay",listP:39.9,listUrl:"https://www.ebay.com/itm/318307960438",costTotal:0,costUnit:0,status:"listed",sales:[],ebayItemId:"318307960438"},
    {id:"MP-049",name:"IFM Efector PN7094 Electronic Pressure Switches /Sensor With Display",sku:"",cat:"Electronics",cond:"no",qty:1,qtyInStock:1,qtySold:0,supplier:"",invoice:"",lots:"",bought:"",received:"",listed:"2026-05-18",rack:1,shelf:2,pos:2,notes:"",channel:"ebay",listP:129.0,listUrl:"https://www.ebay.com/itm/318323642528",costTotal:0,costUnit:0,status:"listed",sales:[],ebayItemId:"318323642528"},
    {id:"MP-050",name:"Schneider Electric M9U21101 Multi9 C60H-DC 1A Circuit Breaker New Open Box",sku:"",cat:"Circuit Breakers",cond:"no",qty:1,qtyInStock:1,qtySold:0,supplier:"",invoice:"",lots:"",bought:"",received:"",listed:"2026-05-18",rack:1,shelf:2,pos:2,notes:"",channel:"ebay",listP:32.9,listUrl:"https://www.ebay.com/itm/318323649761",costTotal:0,costUnit:0,status:"listed",sales:[],ebayItemId:"318323649761"},
    {id:"MP-051",name:"Keyence FT-50AWP Infrared Temperature Sensor 24VDC 1.6W OPEN BOX",sku:"",cat:"Electronics",cond:"no",qty:5,qtyInStock:5,qtySold:0,supplier:"",invoice:"",lots:"",bought:"",received:"",listed:"2026-05-18",rack:1,shelf:2,pos:2,notes:"",channel:"ebay",listP:44.9,listUrl:"https://www.ebay.com/itm/318323652515",costTotal:0,costUnit:0,status:"listed",sales:[],ebayItemId:"318323652515"},
    {id:"MP-052",name:"Schneider Electric M9F42106 Multi 9 Miniature Circuit Breaker 1P 6A 277V",sku:"",cat:"Circuit Breakers",cond:"no",qty:3,qtyInStock:3,qtySold:0,supplier:"",invoice:"",lots:"",bought:"",received:"",listed:"2026-05-18",rack:1,shelf:2,pos:2,notes:"",channel:"ebay",listP:9.9,listUrl:"https://www.ebay.com/itm/318323688333",costTotal:0,costUnit:0,status:"listed",sales:[],ebayItemId:"318323688333"},
    {id:"MP-053",name:"Brad Connectivity Molex 1300180466 Mini-Change 3-Way Junction Tee OPEN BOX",sku:"",cat:"Industrial Automation",cond:"no",qty:4,qtyInStock:4,qtySold:0,supplier:"",invoice:"",lots:"",bought:"",received:"",listed:"2026-05-18",rack:1,shelf:2,pos:2,notes:"",channel:"ebay",listP:12.9,listUrl:"https://www.ebay.com/itm/318323691469",costTotal:0,costUnit:0,status:"listed",sales:[],ebayItemId:"318323691469"},
    {id:"MP-054",name:"Rittal SK3110 Temperature Control Thermostat New Open Box",sku:"",cat:"Electronics",cond:"no",qty:1,qtyInStock:1,qtySold:0,supplier:"",invoice:"",lots:"",bought:"",received:"",listed:"2026-05-18",rack:1,shelf:2,pos:2,notes:"",channel:"ebay",listP:12.9,listUrl:"https://www.ebay.com/itm/318323693539",costTotal:0,costUnit:0,status:"listed",sales:[],ebayItemId:"318323693539"},
    {id:"MP-055",name:"Siemens 6SL3162-2MA00-0AC0 SINAMICS Power Plug New Open Box",sku:"",cat:"Industrial Automation",cond:"no",qty:1,qtyInStock:1,qtySold:0,supplier:"",invoice:"",lots:"",bought:"",received:"",listed:"2026-05-18",rack:1,shelf:2,pos:2,notes:"",channel:"ebay",listP:24.9,listUrl:"https://www.ebay.com/itm/318323695325",costTotal:0,costUnit:0,status:"listed",sales:[],ebayItemId:"318323695325"},
    {id:"MP-056",name:"Weidm\u00fcller 8442960000 MCZ R 24VDC 5UAU Relay Module New Open Box",sku:"",cat:"Industrial Automation",cond:"no",qty:3,qtyInStock:3,qtySold:0,supplier:"",invoice:"",lots:"",bought:"",received:"",listed:"2026-05-18",rack:1,shelf:2,pos:2,notes:"",channel:"ebay",listP:14.9,listUrl:"https://www.ebay.com/itm/318323696783",costTotal:0,costUnit:0,status:"listed",sales:[],ebayItemId:"318323696783"},
    {id:"MP-057",name:"Allen Bradley 1000-194RG2 w 194R-PB 800F-N3G Selector Switch Assembly OpenBox124",sku:"",cat:"Industrial Automation",cond:"no",qty:1,qtyInStock:1,qtySold:0,supplier:"",invoice:"",lots:"",bought:"",received:"",listed:"2026-05-19",rack:1,shelf:1,pos:1,notes:"",channel:"ebay",listP:49.9,listUrl:"https://www.ebay.com/itm/318327300845",costTotal:0,costUnit:0,status:"listed",sales:[],ebayItemId:"318327300845"},
    {id:"MP-058",name:"Conta-Clip RK 95 Terminal Block DIN Rail Feed Through New Open Box",sku:"",cat:"Industrial Automation",cond:"no",qty:4,qtyInStock:4,qtySold:0,supplier:"",invoice:"",lots:"",bought:"",received:"",listed:"2026-05-19",rack:1,shelf:3,pos:2,notes:"",channel:"ebay",listP:22.9,listUrl:"https://www.ebay.com/itm/318327301271",costTotal:0,costUnit:0,status:"listed",sales:[],ebayItemId:"318327301271"},
    {id:"MP-059",name:"Datalogic Powerscan Handheld Scanner PD9531-K2 Standard 5VDC RS-232",sku:"",cat:"Electronics",cond:"no",qty:1,qtyInStock:1,qtySold:0,supplier:"",invoice:"",lots:"",bought:"",received:"",listed:"2026-05-19",rack:1,shelf:1,pos:3,notes:"",channel:"ebay",listP:83.9,listUrl:"https://www.ebay.com/itm/318327301832",costTotal:0,costUnit:0,status:"listed",sales:[],ebayItemId:"318327301832"},
    {id:"MP-060",name:"Datalogic FBC9080-N100 Fieldbus Converter PROFINET Gateway New Open Box",sku:"",cat:"Network Equipment",cond:"no",qty:1,qtyInStock:1,qtySold:0,supplier:"",invoice:"",lots:"",bought:"",received:"",listed:"2026-05-19",rack:1,shelf:1,pos:3,notes:"",channel:"ebay",listP:179.0,listUrl:"https://www.ebay.com/itm/318327302266",costTotal:0,costUnit:0,status:"listed",sales:[],ebayItemId:"318327302266"},
    {id:"MP-061",name:"Datalogic FBC9080-N100 Fieldbus Converter PROFINET Gateway New Open Box",sku:"",cat:"Network Equipment",cond:"no",qty:1,qtyInStock:1,qtySold:0,supplier:"",invoice:"",lots:"",bought:"",received:"",listed:"2026-05-19",rack:1,shelf:3,pos:2,notes:"",channel:"ebay",listP:189.0,listUrl:"https://www.ebay.com/itm/318327302744",costTotal:0,costUnit:0,status:"listed",sales:[],ebayItemId:"318327302744"},
    {id:"MP-062",name:"DEHNguard DG MU 3PY 908314 w DGPLU385 908014 Surge Protector Open Box",sku:"",cat:"Industrial Automation",cond:"no",qty:2,qtyInStock:2,qtySold:0,supplier:"",invoice:"",lots:"",bought:"",received:"",listed:"2026-05-19",rack:1,shelf:3,pos:2,notes:"",channel:"ebay",listP:119.0,listUrl:"https://www.ebay.com/itm/318327303103",costTotal:0,costUnit:0,status:"listed",sales:[],ebayItemId:"318327303103"},
    {id:"MP-063",name:"DEHNguard DG MOD 320  952 013 DG S 320 320V40  125 AMP NEW NO BOX",sku:"",cat:"Industrial Automation",cond:"no",qty:3,qtyInStock:3,qtySold:0,supplier:"",invoice:"",lots:"",bought:"",received:"",listed:"2026-05-19",rack:1,shelf:3,pos:2,notes:"",channel:"ebay",listP:65.9,listUrl:"https://www.ebay.com/itm/318327303607",costTotal:0,costUnit:0,status:"listed",sales:[],ebayItemId:"318327303607"},
    {id:"MP-064",name:"IXYS VUO190-16NO7 1600V 195A Three-Phase Rectifier Power Module Open Box 1.3.2b",sku:"",cat:"Industrial Automation",cond:"no",qty:2,qtyInStock:2,qtySold:0,supplier:"",invoice:"",lots:"",bought:"",received:"",listed:"2026-05-20",rack:1,shelf:1,pos:1,notes:"",channel:"ebay",listP:79.9,listUrl:"https://www.ebay.com/itm/318332795555",costTotal:0,costUnit:0,status:"listed",sales:[],ebayItemId:"318332795555"},
    {id:"MP-065",name:"Siemens 6AV2125-2AE23-0AX0 SIMATIC HMI Connection Box w/ M12 Cables",sku:"",cat:"HMI / Panels",cond:"no",qty:1,qtyInStock:1,qtySold:0,supplier:"",invoice:"",lots:"",bought:"",received:"",listed:"2026-05-20",rack:1,shelf:1,pos:3,notes:"",channel:"ebay",listP:219.0,listUrl:"https://www.ebay.com/itm/318332796472",costTotal:0,costUnit:0,status:"listed",sales:[],ebayItemId:"318332796472"},
    {id:"MP-066",name:"Murrelektronik MICO+ 4.4 9000-41084-0100400 D-71570 Protection Module",sku:"",cat:"Power Supplies",cond:"no",qty:2,qtyInStock:2,qtySold:0,supplier:"",invoice:"",lots:"",bought:"",received:"",listed:"2026-05-20",rack:1,shelf:3,pos:2,notes:"",channel:"ebay",listP:179.0,listUrl:"https://www.ebay.com/itm/318332796880",costTotal:0,costUnit:0,status:"listed",sales:[],ebayItemId:"318332796880"},
    {id:"MP-067",name:"KEYENCE FD-XA5E Clamp-On Micro Flow Sensor Controller Open Box",sku:"",cat:"Electronics",cond:"no",qty:1,qtyInStock:1,qtySold:0,supplier:"",invoice:"",lots:"",bought:"",received:"",listed:"2026-05-20",rack:1,shelf:3,pos:2,notes:"",channel:"ebay",listP:499.0,listUrl:"https://www.ebay.com/itm/318332797294",costTotal:0,costUnit:0,status:"listed",sales:[],ebayItemId:"318332797294"},
    {id:"MP-068",name:"Siemens 5SJ4110-7HG40 SENTRON 4-Pole 10A Circuit Breaker Open Box",sku:"",cat:"Circuit Breakers",cond:"no",qty:122,qtyInStock:122,qtySold:0,supplier:"Michigan Industrial Auctions",invoice:"1410243-312676-1",lots:"57,83,106,201,302",bought:"2026-04-22",received:"2026-04-29",listed:"2026-05-20",rack:1,shelf:3,pos:2,notes:"",channel:"ebay",listP:7.9,listUrl:"https://www.ebay.com/itm/318333770950",costTotal:362.34,costUnit:2.97,status:"listed",sales:[],ebayItemId:"318333770950"},
    {id:"MP-069",name:"NIENTECH USB-NANO 485 USB to RS-485 Industrial Converter Open Box",sku:"",cat:"Industrial Automation",cond:"no",qty:2,qtyInStock:2,qtySold:0,supplier:"",invoice:"",lots:"",bought:"",received:"",listed:"2026-05-21",rack:1,shelf:3,pos:2,notes:"",channel:"ebay",listP:34.9,listUrl:"https://www.ebay.com/itm/318337713404",costTotal:0,costUnit:0,status:"listed",sales:[],ebayItemId:"318337713404"},
    {id:"MP-070",name:"Siemens 5SY4210-7 SENTRON 2-Pole 10A Circuit Breaker Open Box",sku:"",cat:"Circuit Breakers",cond:"no",qty:1,qtyInStock:1,qtySold:0,supplier:"Michigan Industrial Auctions",invoice:"1410243-312676-1",lots:"57,83,106,201,302",bought:"2026-04-22",received:"2026-04-29",listed:"2026-05-21",rack:1,shelf:3,pos:2,notes:"",channel:"ebay",listP:17.9,listUrl:"https://www.ebay.com/itm/318337714192",costTotal:2.97,costUnit:2.97,status:"listed",sales:[],ebayItemId:"318337714192"},
    {id:"MP-071",name:"Siemens 5SJ4150-7HG40 SENTRON 4-Pole 50A Circuit Breaker Open Box",sku:"",cat:"Circuit Breakers",cond:"no",qty:7,qtyInStock:7,qtySold:0,supplier:"Michigan Industrial Auctions",invoice:"1410243-312676-1",lots:"57,83,106,201,302",bought:"2026-04-22",received:"2026-04-29",listed:"2026-05-21",rack:1,shelf:3,pos:4,notes:"",channel:"ebay",listP:15.9,listUrl:"https://www.ebay.com/itm/318337714878",costTotal:20.79,costUnit:2.97,status:"listed",sales:[],ebayItemId:"318337714878"},
    {id:"MP-072",name:"Siemens 5SJ4130-7HG40 SENTRON 4-Pole 30A Circuit Breaker Open Box",sku:"",cat:"Circuit Breakers",cond:"no",qty:10,qtyInStock:10,qtySold:0,supplier:"Michigan Industrial Auctions",invoice:"1410243-312676-1",lots:"57,83,106,201,302",bought:"2026-04-22",received:"2026-04-29",listed:"2026-05-21",rack:1,shelf:3,pos:4,notes:"",channel:"ebay",listP:7.9,listUrl:"https://www.ebay.com/itm/318338337526",costTotal:29.7,costUnit:2.97,status:"listed",sales:[],ebayItemId:"318338337526"},
    {id:"MP-073",name:"Siemens 5SJ4106-7HG40 SENTRON 4-Pole 6A Circuit Breaker Open Box",sku:"",cat:"Circuit Breakers",cond:"no",qty:14,qtyInStock:14,qtySold:0,supplier:"Michigan Industrial Auctions",invoice:"1410243-312676-1",lots:"57,83,106,201,302",bought:"2026-04-22",received:"2026-04-29",listed:"2026-05-21",rack:1,shelf:3,pos:1,notes:"",channel:"ebay",listP:14.9,listUrl:"https://www.ebay.com/itm/318338340554",costTotal:41.58,costUnit:2.97,status:"listed",sales:[],ebayItemId:"318338340554"},
    {id:"MP-074",name:"Siemens 5SJ4102-7HG40 SENTRON 1-Pole 2A Circuit Breaker Open Box",sku:"",cat:"Circuit Breakers",cond:"no",qty:5,qtyInStock:5,qtySold:0,supplier:"Michigan Industrial Auctions",invoice:"1410243-312676-1",lots:"57,83,106,201,302",bought:"2026-04-22",received:"2026-04-29",listed:"2026-05-21",rack:1,shelf:3,pos:4,notes:"",channel:"ebay",listP:8.9,listUrl:"https://www.ebay.com/itm/318338341439",costTotal:14.85,costUnit:2.97,status:"listed",sales:[],ebayItemId:"318338341439"},
    {id:"MP-075",name:"Siemens 5SJ4104-7HG40 SENTRON 4-Pole 4A Circuit Breaker Open Box",sku:"",cat:"Circuit Breakers",cond:"no",qty:25,qtyInStock:25,qtySold:0,supplier:"Michigan Industrial Auctions",invoice:"1410243-312676-1",lots:"57,83,106,201,302",bought:"2026-04-22",received:"2026-04-29",listed:"2026-05-21",rack:1,shelf:2,pos:1,notes:"",channel:"ebay",listP:5.9,listUrl:"https://www.ebay.com/itm/318338342412",costTotal:74.25,costUnit:2.97,status:"listed",sales:[],ebayItemId:"318338342412"},
    {id:"MP-076",name:"Turck FEN20-16DXP Compact IP20 Ethernet I/O Module New Open Box",sku:"",cat:"Network Equipment",cond:"no",qty:1,qtyInStock:1,qtySold:0,supplier:"",invoice:"",lots:"",bought:"",received:"",listed:"2026-05-22",rack:1,shelf:3,pos:2,notes:"",channel:"ebay",listP:129.9,listUrl:"https://www.ebay.com/itm/318344633637",costTotal:0,costUnit:0,status:"listed",sales:[],ebayItemId:"318344633637"},
    {id:"MP-077",name:"Pilz PNOZ X2.8P 24VACDC 3N/O 1N/C 777301 Safety Relay New Open Box",sku:"",cat:"Safety Components",cond:"no",qty:30,qtyInStock:30,qtySold:0,supplier:"Michigan Industrial Auctions",invoice:"1410243-312676-1",lots:"26,42,68,118,162,182,202,217,237,273",bought:"2026-04-22",received:"2026-04-29",listed:"2026-05-22",rack:1,shelf:2,pos:1,notes:"",channel:"ebay",listP:73.9,listUrl:"https://www.ebay.com/itm/318344696209",costTotal:558.6,costUnit:18.62,status:"listed",sales:[],ebayItemId:"318344696209"},
  ];
}

// ── COMPONENTES UI ────────────────────────────────────
function Inp({ val, set, type, ph, ro }) {
  return <input readOnly={ro} type={type || "text"} value={val ?? ""} placeholder={ph || ""} onChange={e => set && set(e.target.value)} style={{ width: "100%", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none", background: ro ? "#f8f8f8" : "#fff", boxSizing: "border-box", fontFamily: "inherit" }} />;
}
function Sel({ val, set, opts }) {
  return <select value={val} onChange={e => set(e.target.value)} style={{ width: "100%", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, background: "#fff", outline: "none", fontFamily: "inherit" }}>{opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>;
}
function Btn({ click, children, color, sm, full, disabled }) {
  const C = { dark: { bg: "#1a1a2e", fg: "#fff" }, green: { bg: "#16a34a", fg: "#fff" }, red: { bg: "#dc2626", fg: "#fff" }, amber: { bg: "#f59e0b", fg: "#000" }, gray: { bg: "#f3f4f6", fg: "#374151" }, white: { bg: "#fff", fg: "#374151", bd: "1px solid #d1d5db" }, blue: { bg: "#2563eb", fg: "#fff" }, purple: { bg: "#7c3aed", fg: "#fff" } };
  const s = C[color || "dark"] || C.dark;
  return <button onClick={click} disabled={disabled} style={{ padding: sm ? "5px 12px" : "9px 18px", border: s.bd || "none", borderRadius: 8, background: disabled ? "#e5e7eb" : s.bg, color: disabled ? "#9ca3af" : s.fg, fontSize: sm ? 11 : 13, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", fontFamily: "inherit", width: full ? "100%" : "auto", whiteSpace: "nowrap" }}>{children}</button>;
}
function STag({ status }) {
  const s = ST[status] || ST.purchased;
  return <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: s.bg, color: s.c, whiteSpace: "nowrap" }}>{s.icon} {s.l}</span>;
}
function FRow({ label, val, bold, color }) {
  return <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "0.5px solid #f3f4f6", fontSize: 13, fontWeight: bold ? 700 : 400 }}><span style={{ color: "#6b7280" }}>{label}</span><span style={{ color: color || "#111" }}>{val}</span></div>;
}
function FG({ label, children, note }) {
  return <div style={{ marginBottom: 12 }}><label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>{label}</label>{children}{note && <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{note}</div>}</div>;
}
function PLBox({ item }) {
  const c = calcPL(item);
  return <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "12px 14px", fontSize: 13 }}>
    <div style={{ fontWeight: 700, fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>{(item.sales || []).length > 0 ? "Actual P&L" : "Projected P&L"}</div>
    <FRow label="Cost / Unit" val={money(c.cu)} color="#dc2626" />
    <FRow label="List Price" val={money(c.lp)} />
    <FRow label={"Fee (" + (PLATFORMS[item.channel]?.label || "") + ")"} val={"-" + money(c.fee)} />
    <FRow label="Est. Net / Unit (28.5%)" val={money(c.eN)} color={c.eN >= 0 ? "#16a34a" : "#dc2626"} bold />
    <FRow label="Est. Margin" val={pct(c.eM)} color={c.eM >= 120 ? "#16a34a" : c.eM >= 50 ? "#d97706" : "#dc2626"} />
    {(item.sales || []).length > 0 && <><div style={{ borderTop: "1px dashed #e2e8f0", margin: "6px 0" }} /><FRow label={"Revenue (" + item.qtySold + " sold)"} val={money(c.rev)} color="#16a34a" /><FRow label="Net Profit (after tax)" val={money(c.net)} bold color={c.net >= 0 ? "#16a34a" : "#dc2626"} /></>}
  </div>;
}

// ── MODAL VENDA ───────────────────────────────────────
function SellModal({ item, onClose, onSave }) {
  const [dt, setDt] = useState(today());
  const [ch, setCh] = useState(item.channel || "ebay");
  const [pr, setPr] = useState("");
  const [sc, setSc] = useState("");
  const [so, setSo] = useState("");
  const [pk, setPk] = useState("");
  const rev = (parseFloat(pr) || 0) + (parseFloat(sc) || 0);
  const pf = rev * (PLATFORMS[ch]?.fee || 0);
  const gross = rev - pf - (parseFloat(so) || 0) - (parseFloat(pk) || 0) - item.costUnit;
  const tax = gross > 0 ? gross * TAX : 0;
  const net = gross - tax;
  function confirm() {
    if (!pr) { alert("Enter sale price"); return; }
    const sale = { date: dt, channel: ch, price: parseFloat(pr), shipCharged: parseFloat(sc) || 0, shipCost: parseFloat(so) || 0, packCost: parseFloat(pk) || 0 };
    const left = Math.max(0, (item.qtyInStock || 0) - 1);
    onSave({ ...item, sales: [...(item.sales || []), sale], qtySold: (item.qtySold || 0) + 1, qtyInStock: left, status: left === 0 ? "sold" : item.status, listed: item.listed || today() });
    onClose();
  }
  return <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 900, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 480, padding: 24, maxHeight: "90vh", overflowY: "auto" }}>
      <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>Record Sale</div>
      <div style={{ fontSize: 13, color: "#888", marginBottom: 12 }}>{item.id} — {item.name}</div>
      <div style={{ background: "#f8fafc", borderRadius: 8, padding: "8px 12px", marginBottom: 14, fontSize: 12, color: "#555" }}>Cost/unit: <strong>{money(item.costUnit)}</strong> · Location: <strong style={{ fontFamily: "monospace" }}>{loc(item)}</strong> · After sale: <strong style={{ color: item.qtyInStock - 1 <= 0 ? "#dc2626" : "#16a34a" }}>{Math.max(0, item.qtyInStock - 1)} remain</strong></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        <FG label="Sale Date"><Inp val={dt} set={setDt} type="date" /></FG>
        <FG label="Platform"><Sel val={ch} set={setCh} opts={Object.entries(PLATFORMS).map(([k, v]) => [k, v.label + " (" + (v.fee * 100).toFixed(1) + "%)"])} /></FG>
        <FG label="Sale Price *"><Inp val={pr} set={setPr} type="number" ph="0.00" /></FG>
        <FG label="Shipping Charged to Buyer"><Inp val={sc} set={setSc} type="number" ph="0.00" /></FG>
        <FG label="Your Shipping Cost"><Inp val={so} set={setSo} type="number" ph="0.00" /></FG>
        <FG label="Packaging Cost"><Inp val={pk} set={setPk} type="number" ph="0.00" /></FG>
      </div>
      <div style={{ background: net >= 0 ? "#f0fdf4" : "#fef2f2", border: "1px solid " + (net >= 0 ? "#86efac" : "#fca5a5"), borderRadius: 8, padding: "10px 14px", marginBottom: 14 }}>
        <FRow label="Revenue" val={money(rev)} color="#16a34a" />
        <FRow label="Platform Fee" val={"-" + money(pf)} color="#dc2626" />
        <FRow label="Cost of Unit" val={"-" + money(item.costUnit)} color="#dc2626" />
        <FRow label="Gross Profit" val={money(gross)} bold />
        <FRow label="Tax (28.5% S-Corp)" val={"-" + money(tax)} color="#dc2626" />
        <div style={{ display: "flex", justifyContent: "space-between", padding: "8px", background: net >= 0 ? "#dcfce7" : "#fee2e2", borderRadius: 6, marginTop: 6, fontWeight: 800, fontSize: 15 }}><span>NET PROFIT</span><span style={{ color: net >= 0 ? "#16a34a" : "#dc2626" }}>{money(net)}</span></div>
      </div>
      <div style={{ display: "flex", gap: 10 }}><Btn click={confirm} color="green" full>Confirm Sale</Btn><Btn click={onClose} color="gray">Cancel</Btn></div>
    </div>
  </div>;
}

// ── MODAL EDITAR ──────────────────────────────────────
function EditModal({ item, onClose, onSave }) {
  const [f, setF] = useState({ ...item });
  const u = k => v => setF(x => ({ ...x, [k]: v }));
  const c = calcPL(f);
  return <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 900, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, overflowY: "auto" }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 660, padding: 24, margin: "auto" }}>
      <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 16 }}>{item._dup ? "Duplicate" : "Edit"} — {item.id}</div>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: "1px solid #e5e7eb", paddingBottom: 6, marginBottom: 12 }}>Product</div>
      <FG label="Product Name *"><Inp val={f.name} set={u("name")} ph="e.g. Siemens TP1200 HMI" /></FG>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}><FG label="SKU"><Inp val={f.sku} set={u("sku")} /></FG></div>
        <div style={{ flex: 1 }}><FG label="Category"><Sel val={f.cat} set={u("cat")} opts={CATS.map(c => [c, c])} /></FG></div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}><FG label="Condition"><Sel val={f.cond} set={u("cond")} opts={Object.entries(COND).map(([k, v]) => [k, v])} /></FG></div>
        <div style={{ flex: 1 }}><FG label="Status"><Sel val={f.status} set={u("status")} opts={Object.entries(ST).map(([k, v]) => [k, v.icon + " " + v.l])} /></FG></div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}><FG label="Total Qty"><Inp val={f.qty} set={u("qty")} type="number" /></FG></div>
        <div style={{ flex: 1 }}><FG label="Qty In Stock"><Inp val={f.qtyInStock} set={u("qtyInStock")} type="number" /></FG></div>
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: "1px solid #e5e7eb", paddingBottom: 6, marginBottom: 12, marginTop: 16 }}>Location (Numbers Only)</div>
      <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 7, padding: "8px 12px", marginBottom: 10, fontSize: 12, color: "#1e40af" }}>Code: <strong style={{ fontFamily: "monospace", fontSize: 14 }}>{f.rack || "?"}-{f.shelf || "?"}-{f.pos || "?"}</strong> = Rack {f.rack || "?"} · {SHELF_NAMES[f.shelf] || "Shelf"} · Pos {f.pos || "?"}</div>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}><FG label="Rack (1-7)"><Sel val={String(f.rack || 1)} set={v => u("rack")(parseInt(v))} opts={Array.from({ length: RACKS }, (_, i) => [String(i + 1), "Rack " + (i + 1)])} /></FG></div>
        <div style={{ flex: 1 }}><FG label="Shelf (1=top, 5=floor)"><Sel val={String(f.shelf || 1)} set={v => u("shelf")(parseInt(v))} opts={Object.entries(SHELF_NAMES).map(([k, v]) => [k, k + " — " + v])} /></FG></div>
        <div style={{ flex: 1 }}><FG label="Position"><Inp val={f.pos} set={v => u("pos")(parseInt(v) || 1)} type="number" ph="1" /></FG></div>
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: "1px solid #e5e7eb", paddingBottom: 6, marginBottom: 12, marginTop: 16 }}>Acquisition</div>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}><FG label="Supplier"><Inp val={f.supplier} set={u("supplier")} /></FG></div>
        <div style={{ flex: 1 }}><FG label="Invoice #"><Inp val={f.invoice} set={u("invoice")} /></FG></div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}><FG label="Lot(s)"><Inp val={f.lots} set={u("lots")} /></FG></div>
        <div style={{ flex: 1 }}><FG label="Purchase Date"><Inp val={f.bought} set={u("bought")} type="date" /></FG></div>
        <div style={{ flex: 1 }}><FG label="Received Date"><Inp val={f.received} set={u("received")} type="date" /></FG></div>
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: "1px solid #e5e7eb", paddingBottom: 6, marginBottom: 12, marginTop: 16 }}>Pricing</div>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}><FG label="Total Cost"><Inp val={f.costTotal} set={u("costTotal")} type="number" /></FG></div>
        <div style={{ flex: 1 }}><FG label="Cost / Unit"><Inp val={f.costUnit} set={u("costUnit")} type="number" /></FG></div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}><FG label="List Price"><Inp val={f.listP} set={u("listP")} type="number" /></FG></div>
        <div style={{ flex: 1 }}><FG label="Channel"><Sel val={f.channel} set={u("channel")} opts={Object.entries(PLATFORMS).map(([k, v]) => [k, v.label])} /></FG></div>
      </div>
      <FG label="Listing URL"><Inp val={f.listUrl} set={u("listUrl")} ph="https://www.ebay.com/itm/..." /></FG>
      <div style={{ background: c.eN >= 0 ? "#f0fdf4" : "#fef2f2", border: "1px solid " + (c.eN >= 0 ? "#86efac" : "#fca5a5"), borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 13 }}>Est. Net/Unit: <strong style={{ color: c.eN >= 0 ? "#16a34a" : "#dc2626" }}>{money(c.eN)}</strong><span style={{ color: "#888", marginLeft: 12 }}>Margin: {pct(c.eM)}</span></div>
      <FG label="Notes"><textarea value={f.notes || ""} onChange={e => u("notes")(e.target.value)} style={{ width: "100%", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, minHeight: 60, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", outline: "none" }} /></FG>
      <div style={{ display: "flex", gap: 10, marginTop: 8 }}><Btn click={() => { if (!f.name.trim()) { alert("Product name required"); return; } onSave(f); }} color="dark">Save</Btn><Btn click={onClose} color="gray">Cancel</Btn></div>
    </div>
  </div>;
}

// ── MODAL INVOICE ─────────────────────────────────────
function InvoiceModal({ existingItems, onClose, onImport }) {
  const [step, setStep] = useState(1);
  const [raw, setRaw] = useState("");
  const [parsed, setParsed] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [sup, setSup] = useState("");
  const [invN, setInvN] = useState("");
  const [bd, setBd] = useState(today());
  const [rd, setRd] = useState("");
  async function parseAI() {
    if (!raw.trim()) { setErr("Paste invoice text first"); return; }
    setLoading(true); setErr("");
    try {
      const prompt = "Parse this industrial auction invoice. Return ONLY a valid JSON array, no markdown.\nEach object: name (string), sku (string), qty (number), bidPrice (number), premium (number), lotNumber (string), cat (Industrial Automation/Servo Motors/HMI - Panels/Circuit Breakers/Power Supplies/Safety Components/Network Equipment/Electronics/Other), listP (suggested eBay price number).\nInvoice:\n" + raw + "\nReturn ONLY the JSON array.";
      const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 4000, messages: [{ role: "user", content: prompt }] }) });
      const data = await res.json();
      const text = (data.content || []).map(b => b.text || "").join("");
      const arr = JSON.parse(text.replace(/```json|```/g, "").trim());
      if (!Array.isArray(arr)) throw new Error("Not an array");
      setParsed(arr.map((it, i) => ({ ...it, selected: true, rack: 1, shelf: 1, pos: i + 1 })));
      setStep(2);
    } catch (e) { setErr("Error: " + e.message); }
    setLoading(false);
  }
  function tog(i) { setParsed(p => p.map((x, j) => j === i ? { ...x, selected: !x.selected } : x)); }
  function upd(i, k, v) { setParsed(p => p.map((x, j) => j === i ? { ...x, [k]: v } : x)); }
  function doImport() {
    const sel = parsed.filter(x => x.selected);
    const newItems = sel.map((it, i) => {
      const total = (parseFloat(it.bidPrice) || 0) + (parseFloat(it.premium) || 0);
      const qty = parseInt(it.qty) || 1;
      return { id: genId([...existingItems, ...sel.slice(0, i)]), name: it.name, sku: it.sku || "", cat: it.cat || "Industrial Automation", cond: "uw", qty, qtyInStock: qty, qtySold: 0, supplier: sup, invoice: invN, lots: it.lotNumber || "", bought: bd, received: rd, listed: "", rack: parseInt(it.rack) || 1, shelf: parseInt(it.shelf) || 1, pos: parseInt(it.pos) || 1, notes: "", channel: "ebay", listP: parseFloat(it.listP) || "", listUrl: "", costTotal: total, costUnit: qty > 0 ? Math.round(total / qty * 100) / 100 : total, status: "purchased", sales: [] };
    });
    onImport(newItems); onClose();
  }
  return <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 950, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, overflowY: "auto" }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 680, padding: 24, margin: "auto" }}>
      <div style={{ display: "flex", gap: 0, marginBottom: 20 }}>
        {[["1", "Paste Invoice"], ["2", "Review Items"], ["3", "Locations"]].map(([n, l], i) => (
          <div key={n} style={{ display: "flex", alignItems: "center", flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, background: step > i + 1 ? "#16a34a" : step === i + 1 ? "#1a1a2e" : "#e5e7eb", color: step >= i + 1 ? "#fff" : "#9ca3af" }}>{step > i + 1 ? "v" : n}</div>
              <span style={{ fontSize: 12, fontWeight: step === i + 1 ? 700 : 400, color: step === i + 1 ? "#1a1a2e" : "#9ca3af" }}>{l}</span>
            </div>
            {i < 2 && <div style={{ flex: 1, height: 1, background: "#e5e7eb", margin: "0 8px" }} />}
          </div>
        ))}
      </div>
      {step === 1 && <>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>Import Invoice — AI reads it automatically</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 200 }}><FG label="Supplier"><Inp val={sup} set={setSup} ph="Michigan Industrial Auctions" /></FG></div>
          <div style={{ flex: 1, minWidth: 150 }}><FG label="Invoice Number"><Inp val={invN} set={setInvN} ph="1410243-312676-1" /></FG></div>
          <div style={{ flex: 1, minWidth: 140 }}><FG label="Purchase Date"><Inp val={bd} set={setBd} type="date" /></FG></div>
          <div style={{ flex: 1, minWidth: 140 }}><FG label="Expected Receive Date"><Inp val={rd} set={setRd} type="date" /></FG></div>
        </div>
        <FG label="Paste Invoice Text" note="Copy all text from the PDF and paste here"><textarea value={raw} onChange={e => setRaw(e.target.value)} placeholder={"Paste invoice content here...\n\nLot 41 | Siemens TP1200 HMI | Bid $275 | Premium $49.50\n..."} style={{ width: "100%", height: 200, padding: 10, border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12, fontFamily: "monospace", resize: "vertical", boxSizing: "border-box", outline: "none" }} /></FG>
        {err && <div style={{ color: "#dc2626", fontSize: 12, marginBottom: 8 }}>{err}</div>}
        <div style={{ display: "flex", gap: 10 }}><Btn click={parseAI} color="dark" disabled={loading}>{loading ? "Reading invoice..." : "Read with AI"}</Btn><Btn click={onClose} color="gray">Cancel</Btn></div>
      </>}
      {step === 2 && <>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{parsed.filter(x => x.selected).length} of {parsed.length} items selected</div>
        <div style={{ maxHeight: 380, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 8, marginBottom: 14 }}>
          {parsed.map((it, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 12px", borderBottom: "0.5px solid #f3f4f6", background: it.selected ? "#fff" : "#fafafa", opacity: it.selected ? 1 : 0.5 }}>
              <input type="checkbox" checked={it.selected} onChange={() => tog(i)} style={{ flexShrink: 0, width: 16, height: 16, cursor: "pointer" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</div>
                <div style={{ display: "flex", gap: 10, marginTop: 3 }}><span style={{ fontSize: 11, color: "#888" }}>Lot: {it.lotNumber || "—"}</span><span style={{ fontSize: 11, color: "#888" }}>Qty: {it.qty || 1}</span><span style={{ fontSize: 11, color: "#dc2626" }}>Bid: ${it.bidPrice || 0}</span></div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <input type="number" value={it.listP || ""} onChange={e => upd(i, "listP", e.target.value)} placeholder="List $" style={{ width: 72, padding: "4px 6px", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 12, outline: "none" }} />
                <select value={it.cat || "Industrial Automation"} onChange={e => upd(i, "cat", e.target.value)} style={{ fontSize: 11, padding: "4px 6px", border: "1px solid #e5e7eb", borderRadius: 6, maxWidth: 140, outline: "none" }}>{CATS.map(c => <option key={c} value={c}>{c}</option>)}</select>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10 }}><Btn click={() => setStep(3)} color="dark">Set Locations</Btn><Btn click={() => setStep(1)} color="gray">Back</Btn></div>
      </>}
      {step === 3 && <>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Set Locations — numbers only</div>
        <div style={{ maxHeight: 360, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 8, marginBottom: 14 }}>
          {parsed.filter(x => x.selected).map((it, i) => {
            const ri = parsed.indexOf(it);
            return <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 12px", borderBottom: "0.5px solid #f3f4f6" }}>
              <div style={{ flex: 1, fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name.split(" ").slice(0, 5).join(" ")}</div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                <div><div style={{ fontSize: 10, color: "#888", marginBottom: 1 }}>Rack</div><select value={String(it.rack || 1)} onChange={e => upd(ri, "rack", parseInt(e.target.value))} style={{ padding: "4px 6px", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 12, width: 55, outline: "none" }}>{Array.from({ length: 7 }, (_, j) => <option key={j + 1} value={j + 1}>R{j + 1}</option>)}</select></div>
                <div><div style={{ fontSize: 10, color: "#888", marginBottom: 1 }}>Shelf</div><select value={String(it.shelf || 1)} onChange={e => upd(ri, "shelf", parseInt(e.target.value))} style={{ padding: "4px 6px", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 12, width: 75, outline: "none" }}>{Object.entries(SHELF_NAMES).map(([k, v]) => <option key={k} value={k}>{k} {v.includes("Floor") ? "(Floor)" : ""}</option>)}</select></div>
                <div><div style={{ fontSize: 10, color: "#888", marginBottom: 1 }}>Pos</div><input type="number" value={it.pos || 1} onChange={e => upd(ri, "pos", parseInt(e.target.value))} style={{ width: 46, padding: "4px 6px", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 12, outline: "none" }} /></div>
                <div style={{ fontFamily: "monospace", fontWeight: 800, fontSize: 13, color: "#1a1a2e", marginTop: 14 }}>{it.rack || 1}-{it.shelf || 1}-{it.pos || 1}</div>
              </div>
            </div>;
          })}
        </div>
        <div style={{ display: "flex", gap: 10 }}><Btn click={doImport} color="green">Import {parsed.filter(x => x.selected).length} Items</Btn><Btn click={() => setStep(2)} color="gray">Back</Btn></div>
      </>}
    </div>
  </div>;
}

// ── DRAWER DETALHES ───────────────────────────────────
function Drawer({ item, onClose, onEdit, onSell, onDup }) {
  const c = calcPL(item);
  return <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 800, display: "flex", justifyContent: "flex-end" }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div style={{ background: "#fff", width: "100%", maxWidth: 400, height: "100%", overflowY: "auto", padding: 24, boxShadow: "-4px 0 24px rgba(0,0,0,0.12)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div><div style={{ fontFamily: "monospace", fontSize: 22, fontWeight: 900, color: "#1a1a2e" }}>{item.id}</div><STag status={item.status} /></div>
        <button onClick={onClose} style={{ background: "transparent", border: "none", fontSize: 22, cursor: "pointer", color: "#bbb" }}>x</button>
      </div>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, lineHeight: 1.3 }}>{item.name}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
        {[["Stock", item.qtyInStock, "#1d4ed8", "#dbeafe"], ["Sold", item.qtySold, "#16a34a", "#dcfce7"], ["Total", item.qty, "#374151", "#f3f4f6"]].map(([l, n, co, bg]) => (
          <div key={l} style={{ textAlign: "center", background: bg, borderRadius: 8, padding: "8px 4px" }}><div style={{ fontSize: 10, color: "#6b7280" }}>{l}</div><div style={{ fontSize: 24, fontWeight: 900, color: co }}>{n}</div></div>
        ))}
      </div>
      <div style={{ background: "#1a1a2e", borderRadius: 10, padding: "12px 16px", marginBottom: 14, display: "flex", gap: 14, alignItems: "center" }}>
        <div style={{ fontSize: 28 }}>📍</div>
        <div><div style={{ fontSize: 10, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em" }}>Location</div><div style={{ fontSize: 28, fontWeight: 900, color: "#f59e0b", fontFamily: "monospace" }}>{loc(item)}</div><div style={{ fontSize: 11, color: "#9ca3af" }}>{locFull(item)}</div></div>
      </div>
      {[["SKU", item.sku], ["Supplier", item.supplier], ["Invoice", item.invoice], ["Lots", item.lots], ["Purchased", item.bought], ["Received", item.received]].map(([l, v]) => v ? <FRow key={l} label={l} val={v} /> : null)}
      {item.notes && <div style={{ background: "#f8fafc", borderRadius: 6, padding: "8px 10px", fontSize: 12, color: "#555", marginTop: 8, lineHeight: 1.5 }}>{item.notes}</div>}
      <div style={{ marginTop: 14 }}><PLBox item={item} /></div>
      {(item.sales || []).length > 0 && <div style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8 }}>Sales History</div>
        {item.sales.map((s, i) => {
          const r = (parseFloat(s.price) || 0) + (parseFloat(s.shipCharged) || 0);
          const pf = r * (PLATFORMS[s.channel || item.channel]?.fee || 0);
          const g = r - pf - (parseFloat(s.shipCost) || 0) - (parseFloat(s.packCost) || 0) - item.costUnit;
          const n = g - (g > 0 ? g * TAX : 0);
          return <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "6px 10px", background: i % 2 ? "#fafafa" : "#fff", borderRadius: 6, marginBottom: 3 }}><span style={{ color: "#888" }}>{s.date} · {money(s.price)}</span><span style={{ fontWeight: 700, color: n >= 0 ? "#16a34a" : "#dc2626" }}>{money(n)} net</span></div>;
        })}
      </div>}
      <div style={{ display: "flex", gap: 8, marginTop: 20, flexWrap: "wrap" }}>
        {item.qtyInStock > 0 && <Btn click={onSell} color="green">Record Sale</Btn>}
        <Btn click={onEdit} color="white">Edit</Btn>
        <Btn click={onDup} color="purple">Duplicate</Btn>
      </div>
    </div>
  </div>;
}

// ── MAPA WAREHOUSE ────────────────────────────────────
function WMap({ items, onSelect }) {
  return <div>
    <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#1e40af" }}>Location: Rack-Shelf-Position (all numbers) · Shelf 1=top · Shelf 5=Floor · Rack 1 active now</div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
      {Array.from({ length: RACKS }, (_, ri) => ri + 1).map(rack => {
        const rItems = items.filter(i => Number(i.rack) === rack);
        const active = rItems.length > 0;
        return <div key={rack} style={{ background: active ? "#fff" : "#fafafa", border: "1px solid " + (active ? "#e5e7eb" : "#f3f4f6"), borderRadius: 10, overflow: "hidden", opacity: active ? 1 : 0.55 }}>
          <div style={{ background: active ? "#1a1a2e" : "#9ca3af", color: "#fff", padding: "8px 14px", display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>RACK {rack}</span>
            <span style={{ fontSize: 11, color: "#9ca3af" }}>{active ? rItems.length + " products" : "Future rack"}</span>
          </div>
          {[1, 2, 3, 4, 5].map(shelf => {
            const shItems = items.filter(i => Number(i.rack) === rack && Number(i.shelf) === shelf);
            const isFloor = shelf === 5;
            return <div key={shelf} style={{ display: "flex", gap: 4, padding: "4px 8px", borderBottom: "0.5px solid #f3f4f6", alignItems: "stretch", background: isFloor ? "#faf5eb" : "transparent" }}>
              <div style={{ width: 30, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: isFloor ? "#92400e" : "#9ca3af", background: isFloor ? "#fef3c7" : "#f8fafc", borderRadius: 4, flexShrink: 0, border: "1px solid " + (isFloor ? "#fcd34d" : "#f3f4f6") }}>{isFloor ? "F" : shelf}</div>
              <div style={{ flex: 1, display: "flex", gap: 4, flexWrap: "wrap" }}>
                {shItems.length > 0 ? shItems.map(item => <div key={item.id} onClick={() => onSelect(item.id)} style={{ minWidth: 80, flex: 1, borderRadius: 6, padding: "4px 6px", cursor: "pointer", border: "1px solid", background: item.qtyInStock === 0 ? "#f0fdf4" : item.status === "listed" ? "#fef3c7" : "#eff6ff", borderColor: item.qtyInStock === 0 ? "#86efac" : item.status === "listed" ? "#fcd34d" : "#bfdbfe" }}>
                  <div style={{ fontSize: 9, fontWeight: 900, color: "#1a1a2e" }}>{item.id}</div>
                  <div style={{ fontSize: 10, color: "#374151", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 }}>{item.name.split(" ").slice(0, 3).join(" ")}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}><span style={{ fontSize: 9, color: item.qtyInStock <= 2 ? "#dc2626" : "#6b7280", fontWeight: 700 }}>x{item.qtyInStock}</span><span style={{ fontSize: 9, color: item.qtySold > 0 ? "#16a34a" : "#9ca3af", fontWeight: 700 }}>{item.qtySold}sold</span></div>
                </div>) : <div style={{ flex: 1, background: "#fafafa", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 44, border: "1px dashed #e5e7eb" }}><span style={{ fontSize: 10, color: "#d1d5db" }}>{rack}-{shelf} free</span></div>}
              </div>
            </div>;
          })}
        </div>;
      })}
    </div>
  </div>;
}

// ── APP PRINCIPAL ─────────────────────────────────────
export default function App() {
  const [items, setItems]       = useState([]);
  const [tab, setTab]           = useState("dashboard");
  const [detailId, setDetailId] = useState(null);
  const [sellId, setSellId]     = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [showInv, setShowInv]   = useState(false);
  const [search, setSearch]     = useState("");
  const [stFlt, setStFlt]       = useState("all");
  const [toast, setToast]       = useState(null);
  const [loaded, setLoaded]     = useState(false);
  const [cloudOk, setCloudOk]   = useState(false);

  // ── CARREGAR DADOS ──────────────────────────────────
  // Estratégia: Supabase (nuvem) → localStorage (local) → dados iniciais
  useEffect(() => {
    (async () => {
      const seed = buildSeed();
      try {
        const cloud = await cloudLoad();
        if (cloud && cloud.length >= seed.length) {
          setItems(cloud); localSave(cloud); setCloudOk(true); setLoaded(true); return;
        }
        const local = localLoad();
        if (local && local.length >= seed.length) {
          setItems(local); cloudSave(local); setCloudOk(true); setLoaded(true); return;
        }
        setItems(seed); localSave(seed); cloudSave(seed); setCloudOk(true);
      } catch { setItems(seed); }
      setLoaded(true);
    })();
  }, []);

  // ── SALVAR DADOS ────────────────────────────────────
  // Salva em AMBOS: localStorage (imediato) + Supabase (nuvem)
  async function persist(data) {
    setItems(data);
    localSave(data);   // salva no navegador — IMEDIATO
    cloudSave(data);   // salva na nuvem — para outros dispositivos
    setCloudOk(true);
  }

  function toast$(msg, ok) { setToast({ msg, ok: ok !== false }); setTimeout(() => setToast(null), 4000); }

  function saveItem(upd) {
    const exists = items.find(i => i.id === upd.id);
    persist(exists ? items.map(i => i.id === upd.id ? upd : i) : [...items, upd]);
    setEditItem(null); setDetailId(null);
    toast$("Saved: " + upd.id);
  }
  function saveSale(upd) { persist(items.map(i => i.id === upd.id ? upd : i)); setSellId(null); toast$("Sale recorded!"); }
  function importItems(newItems) { persist([...items, ...newItems]); toast$(newItems.length + " items imported!"); }

  function startNew() {
    setEditItem({ id: genId(items), name: "", sku: "", cat: "Industrial Automation", cond: "uw", qty: 1, qtyInStock: 1, qtySold: 0, supplier: "", invoice: "", lots: "", bought: today(), received: "", listed: "", rack: 1, shelf: 1, pos: 1, notes: "", channel: "ebay", listP: "", listUrl: "", costTotal: "", costUnit: "", status: "purchased", sales: [] });
    setDetailId(null);
  }
  function dupItem(item) { setEditItem({ ...item, id: genId(items), sales: [], qtySold: 0, status: "received", listed: "", _dup: true }); setDetailId(null); }

  function exportData() {
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "mp-erp-backup-" + today() + ".json"; a.click(); URL.revokeObjectURL(url);
    toast$("Backup downloaded!");
  }
  function importFile(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { try { const data = JSON.parse(ev.target.result); if (!Array.isArray(data)) throw new Error(); persist(data); toast$(data.length + " items loaded!"); } catch { toast$("Invalid file", false); } };
    reader.readAsText(file); e.target.value = "";
  }

  const detailItem = detailId ? items.find(i => i.id === detailId) : null;
  const sellItem   = sellId   ? items.find(i => i.id === sellId)   : null;
  const totalNet   = items.reduce((a, i) => a + calcPL(i).net, 0);
  const stockVal   = items.reduce((a, i) => a + calcPL(i).cu * (i.qtyInStock || 0), 0);
  const totalSold  = items.reduce((a, i) => a + (i.qtySold || 0), 0);
  const totalStock = items.reduce((a, i) => a + (i.qtyInStock || 0), 0);
  const filtered   = items.filter(i => {
    if (stFlt !== "all" && i.status !== stFlt) return false;
    if (search) { const q = search.toLowerCase(); return i.name.toLowerCase().includes(q) || i.id.toLowerCase().includes(q) || (i.sku || "").toLowerCase().includes(q) || (i.invoice || "").toLowerCase().includes(q); }
    return true;
  });

  const TABS = [{ id: "dashboard", icon: "📊", label: "Dashboard" }, { id: "inventory", icon: "📦", label: "Inventory" }, { id: "map", icon: "🗺", label: "Warehouse" }, { id: "analytics", icon: "📈", label: "Analytics" }];

  if (!loaded) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", flexDirection: "column", gap: 16, color: "#888", fontFamily: "system-ui, sans-serif" }}><div style={{ fontSize: 48 }}>☁</div><div style={{ fontSize: 18, fontWeight: 700 }}>Loading...</div></div>;

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, sans-serif", minHeight: "100vh", background: "#f4f5f7", color: "#111" }}>

      {toast && <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999, background: toast.ok ? "#1a1a2e" : "#dc2626", color: "#fff", padding: "10px 20px", borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: "0 4px 24px rgba(0,0,0,0.3)", maxWidth: 340 }}>{toast.msg}</div>}

      {sellItem  && <SellModal    item={sellItem}  onClose={() => setSellId(null)}  onSave={saveSale} />}
      {editItem  && <EditModal    item={editItem}  onClose={() => setEditItem(null)} onSave={saveItem} />}
      {showInv   && <InvoiceModal existingItems={items} onClose={() => setShowInv(false)} onImport={importItems} />}
      {detailItem && !sellId && !editItem && !showInv && <Drawer item={detailItem} onClose={() => setDetailId(null)} onEdit={() => { setEditItem(detailItem); setDetailId(null); }} onSell={() => { setSellId(detailItem.id); setDetailId(null); }} onDup={() => dupItem(detailItem)} />}

      {/* HEADER */}
      <div style={{ background: "#1a1a2e", color: "#fff", padding: "0 20px" }}>
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0 10px", flexWrap: "wrap", gap: 10 }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: "0.18em", color: "#6b7280", textTransform: "uppercase" }}>MP Business Strategy LLC · S-Corp · FL/SC</div>
              <div style={{ fontSize: 20, fontWeight: 900 }}>Inventory + Warehouse ERP</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                <span style={{ fontSize: 11, color: "#6b7280" }}>{items.length} products · {totalStock} in stock · {totalSold} sold</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: cloudOk ? "#4ade80" : "#fbbf24", background: "rgba(255,255,255,0.1)", padding: "2px 8px", borderRadius: 20 }}>{cloudOk ? "☁ Cloud ON" : "⚠ Local only"}</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button onClick={startNew} style={{ padding: "8px 14px", background: "#f59e0b", border: "none", borderRadius: 8, color: "#000", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>+ Add</button>
              <button onClick={() => setShowInv(true)} style={{ padding: "8px 14px", background: "#7c3aed", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Invoice</button>
              <button onClick={exportData} style={{ padding: "8px 14px", background: "#2563eb", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Export</button>
              <label style={{ padding: "8px 14px", background: "#16a34a", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", display: "inline-block" }}>Import<input type="file" accept=".json" onChange={importFile} style={{ display: "none" }} /></label>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase" }}>Net Profit (28.5%)</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#4ade80" }}>{money(totalNet)}</div>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", overflowX: "auto", borderTop: "1px solid #2d2d4e" }}>
            {TABS.map(t => <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "10px 18px", background: "transparent", border: "none", color: tab === t.id ? "#fff" : "#6b7280", fontSize: 13, fontWeight: tab === t.id ? 700 : 400, cursor: "pointer", borderBottom: tab === t.id ? "2px solid #f59e0b" : "2px solid transparent", fontFamily: "inherit", whiteSpace: "nowrap" }}>{t.icon} {t.label}</button>)}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 980, margin: "0 auto", padding: "20px 16px 60px" }}>

        {/* DASHBOARD */}
        {tab === "dashboard" && <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 20 }}>
            {[{ l: "Net Profit (28.5%)", v: money(totalNet), s: totalSold + " units sold", c: "#16a34a", bg: "#f0fdf4" }, { l: "Capital in Stock", v: money(stockVal), s: totalStock + " units", c: "#d97706", bg: "#fffbeb" }, { l: "Products", v: items.length, s: "registered", c: "#2563eb", bg: "#eff6ff" }, { l: "Tax Reserve (28.5%)", v: money(items.reduce((a, i) => a + calcPL(i).taxAmt, 0)), s: "S-Corp FL/SC", c: "#dc2626", bg: "#fef2f2" }, { l: "Est. Potential", v: money(items.reduce((a, i) => a + calcPL(i).eN * (i.qtyInStock || 0), 0)), s: "all at list price", c: "#7c3aed", bg: "#f5f3ff" }].map((k, i) => (
              <div key={i} style={{ background: k.bg, border: "1px solid " + k.c + "22", borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{k.l}</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: k.c, marginBottom: 2 }}>{k.v}</div>
                <div style={{ fontSize: 11, color: "#9ca3af" }}>{k.s}</div>
              </div>
            ))}
          </div>
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ background: "#f8fafc", borderBottom: "1px solid #e5e7eb", padding: "12px 16px", fontWeight: 700, fontSize: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>All Products</span>
              <button onClick={() => setTab("inventory")} style={{ padding: "5px 12px", background: "#f3f4f6", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>View All</button>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr style={{ background: "#f8fafc" }}>{["ID", "Product", "Location", "Stock", "Sold", "Est. Net/Unit", "Status"].map(h => <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, fontSize: 10, color: "#6b7280", textTransform: "uppercase", borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" }}>{h}</th>)}</tr></thead>
                <tbody>
                  {items.map((it, idx) => {
                    const c = calcPL(it);
                    return <tr key={it.id} onClick={() => setDetailId(it.id)} style={{ borderBottom: "0.5px solid #f3f4f6", cursor: "pointer", background: idx % 2 === 0 ? "#fff" : "#fafafa" }} onMouseEnter={e => e.currentTarget.style.background = "#eff6ff"} onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? "#fff" : "#fafafa"}>
                      <td style={{ padding: "9px 12px", fontFamily: "monospace", fontWeight: 700, color: "#1a1a2e" }}>{it.id}</td>
                      <td style={{ padding: "9px 12px", fontWeight: 600, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</td>
                      <td style={{ padding: "9px 12px" }}><span style={{ fontFamily: "monospace", fontSize: 12, background: "#f3f4f6", padding: "2px 8px", borderRadius: 20, fontWeight: 700 }}>{loc(it)}</span></td>
                      <td style={{ padding: "9px 12px", textAlign: "center" }}><span style={{ background: it.qtyInStock === 0 ? "#dcfce7" : it.qtyInStock <= 2 ? "#fef3c7" : "#dbeafe", color: it.qtyInStock === 0 ? "#166534" : it.qtyInStock <= 2 ? "#92400e" : "#1d4ed8", padding: "2px 10px", borderRadius: 20, fontWeight: 700 }}>{it.qtyInStock}</span></td>
                      <td style={{ padding: "9px 12px", textAlign: "center" }}><span style={{ background: it.qtySold > 0 ? "#dcfce7" : "#f3f4f6", color: it.qtySold > 0 ? "#166534" : "#9ca3af", padding: "2px 10px", borderRadius: 20, fontWeight: 700 }}>{it.qtySold}</span></td>
                      <td style={{ padding: "9px 12px", fontWeight: 700, color: c.eN >= 0 ? "#16a34a" : "#dc2626" }}>{money(c.eN)}</td>
                      <td style={{ padding: "9px 12px" }}><STag status={it.status} /></td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>}

        {/* INVENTORY */}
        {tab === "inventory" && <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, ID, SKU, invoice..." style={{ flex: 1, minWidth: 200, padding: "10px 14px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none", fontFamily: "inherit", background: "#fff" }} />
            <Sel val={stFlt} set={setStFlt} opts={[["all", "All Status"], ...Object.entries(ST).map(([k, v]) => [k, v.icon + " " + v.l])]} />
            <Btn click={startNew} color="dark">+ Add Item</Btn>
          </div>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>{filtered.length} items · {totalStock} in stock · {totalSold} sold</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
            {filtered.map(item => {
              const c = calcPL(item);
              const days = item.received && item.status !== "sold" ? Math.ceil((new Date() - new Date(item.received)) / 86400000) : null;
              return <div key={item.id} onClick={() => setDetailId(item.id)} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, cursor: "pointer" }} onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 2px 16px rgba(0,0,0,0.08)"; e.currentTarget.style.borderColor = "#bfdbfe"; }} onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = "#e5e7eb"; }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <span style={{ fontFamily: "monospace", fontWeight: 900, fontSize: 14, color: "#1a1a2e" }}>{item.id}</span>
                  <STag status={item.status} />
                </div>
                <div style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.3, marginBottom: 8 }}>{item.name}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                  <span style={{ fontSize: 10, background: "#f3f4f6", color: "#374151", padding: "2px 8px", borderRadius: 20, fontFamily: "monospace", fontWeight: 700 }}>📍 {loc(item)}</span>
                  {days != null && <span style={{ fontSize: 10, color: days > 60 ? "#dc2626" : days > 30 ? "#d97706" : "#16a34a" }}>{days}d in stock</span>}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 10 }}>
                  {[{ l: "Stock", v: item.qtyInStock, c: "#2563eb", bg: "#dbeafe" }, { l: "Sold", v: item.qtySold, c: "#16a34a", bg: "#dcfce7" }, { l: "Est.Net", v: money(c.eN), c: c.eN >= 0 ? "#16a34a" : "#dc2626", bg: "#f8fafc" }].map((x, i) => <div key={i} style={{ background: x.bg, borderRadius: 6, padding: "5px 8px", textAlign: "center" }}><div style={{ fontSize: 9, color: "#6b7280", textTransform: "uppercase" }}>{x.l}</div><div style={{ fontWeight: 800, fontSize: 13, color: x.c }}>{x.v}</div></div>)}
                </div>
                <div style={{ display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
                  {item.qtyInStock > 0 && <Btn click={() => setSellId(item.id)} color="green" sm full>Record Sale</Btn>}
                  <Btn click={() => dupItem(item)} color="purple" sm>Dup</Btn>
                </div>
              </div>;
            })}
          </div>
        </div>}

        {tab === "map" && <WMap items={items} onSelect={id => setDetailId(id)} />}

        {/* ANALYTICS */}
        {tab === "analytics" && <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 20 }}>
            {[{ l: "Total Invested", v: money(items.reduce((a, i) => a + calcPL(i).totalCostIn, 0)), c: "#dc2626" }, { l: "Revenue (sold)", v: money(items.reduce((a, i) => a + calcPL(i).rev, 0)), c: "#16a34a" }, { l: "Gross Profit", v: money(items.reduce((a, i) => a + calcPL(i).gross, 0)), c: "#d97706" }, { l: "Tax Reserve", v: money(items.reduce((a, i) => a + calcPL(i).taxAmt, 0)), c: "#dc2626" }, { l: "Net Profit", v: money(totalNet), c: "#16a34a" }].map((k, i) => <div key={i} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 14 }}><div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{k.l}</div><div style={{ fontSize: 20, fontWeight: 900, color: k.c }}>{k.v}</div></div>)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ background: "#f8fafc", borderBottom: "1px solid #e5e7eb", padding: "12px 16px", fontWeight: 700, fontSize: 14 }}>Best Margin / Unit</div>
              <div style={{ padding: "0 16px" }}>
                {[...items].sort((a, b) => calcPL(b).eN - calcPL(a).eN).slice(0, 8).map((it, i) => {
                  const c = calcPL(it);
                  return <div key={it.id} onClick={() => setDetailId(it.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "0.5px solid #f3f4f6", cursor: "pointer" }}>
                    <div><span style={{ fontWeight: 900, color: "#f59e0b", marginRight: 6 }}>#{i + 1}</span><span style={{ fontWeight: 600 }}>{it.id}</span><div style={{ fontSize: 11, color: "#888" }}>{it.name.split(" ").slice(0, 4).join(" ")} · x{it.qtyInStock}</div></div>
                    <div style={{ textAlign: "right" }}><div style={{ fontWeight: 800, color: c.eN >= 0 ? "#16a34a" : "#dc2626" }}>{money(c.eN)}</div><div style={{ fontSize: 11, color: c.eM >= 120 ? "#16a34a" : "#d97706" }}>{pct(c.eM)}</div></div>
                  </div>;
                })}
              </div>
            </div>
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ background: "#f8fafc", borderBottom: "1px solid #e5e7eb", padding: "12px 16px", fontWeight: 700, fontSize: 14 }}>Longest in Stock</div>
              <div style={{ padding: "0 16px" }}>
                {[...items.filter(i => i.received && i.qtyInStock > 0)].map(i => ({ ...i, days: Math.ceil((new Date() - new Date(i.received)) / 86400000) })).sort((a, b) => b.days - a.days).slice(0, 8).map(it => (
                  <div key={it.id} onClick={() => setDetailId(it.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "0.5px solid #f3f4f6", cursor: "pointer" }}>
                    <div><span style={{ fontWeight: 600 }}>{it.id}</span><div style={{ fontSize: 11, color: "#888" }}>{it.name.split(" ").slice(0, 4).join(" ")}</div></div>
                    <div style={{ textAlign: "right" }}><div style={{ fontWeight: 800, color: it.days > 60 ? "#dc2626" : it.days > 30 ? "#d97706" : "#16a34a" }}>{it.days}d</div><div style={{ fontSize: 11, color: "#888" }}>x{it.qtyInStock} left</div></div>
                  </div>
                ))}
                <div style={{ background: "#fffbeb", borderRadius: 8, padding: "8px 12px", margin: "10px 0", fontSize: 12, color: "#78350f" }}>Items over 60 days: consider reducing price 10-15%.</div>
              </div>
            </div>
          </div>
        </div>}
      </div>
    </div>
  );
}
