import { useState, useEffect } from "react";

// ── Constants ──────────────────────────────────────────────
const TAX = 0.285;
const RACKS = 7;
const PLATFORMS = {
  ebay:    { label: "eBay",          fee: 0.1325 },
  amazon:  { label: "Amazon",        fee: 0.15   },
  shopify: { label: "Shopify",       fee: 0.029  },
  fb:      { label: "Facebook Mkt",  fee: 0.05   },
  direct:  { label: "Direct / Cash", fee: 0      },
};
const SHELF_NAMES = { 1: "Shelf 1 (top)", 2: "Shelf 2", 3: "Shelf 3", 4: "Shelf 4", 5: "Floor" };
const CATS = ["Industrial Automation","Servo Motors","HMI / Panels","Circuit Breakers","Power Supplies","Safety Components","Network Equipment","Electronics","Other"];
const COND = { ns: "New Sealed", no: "New Open Box", rf: "Refurbished", uw: "Used / Working", uu: "Used / Untested" };
const ST = {
  purchased: { l: "Purchased", c: "#78716c", bg: "#f5f5f4", icon: "🛒" },
  received:  { l: "In Stock",  c: "#2563eb", bg: "#dbeafe", icon: "📦" },
  listed:    { l: "Listed",    c: "#d97706", bg: "#fef3c7", icon: "📢" },
  sold:      { l: "Sold",      c: "#16a34a", bg: "#dcfce7", icon: "✅" },
  removed:   { l: "Removed",   c: "#dc2626", bg: "#fee2e2", icon: "🗑"  },
};

// ── Helpers ───────────────────────────────────────────────
function loc(item) {
  if (!item.rack || !item.shelf) return "—";
  return item.pos ? `${item.rack}-${item.shelf}-${item.pos}` : `${item.rack}-${item.shelf}`;
}
function locFull(item) {
  if (!item.rack || !item.shelf) return "No location";
  return `Rack ${item.rack} · ${SHELF_NAMES[item.shelf] || "Shelf " + item.shelf}${item.pos ? " · Pos " + item.pos : ""}`;
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
  const cu  = parseFloat(item.costUnit) || 0;
  const lp  = parseFloat(item.listP) || 0;
  const fee = lp * (PLATFORMS[item.channel]?.fee || 0);
  const eG  = lp - fee - cu;
  const eT  = eG > 0 ? eG * TAX : 0;
  const eN  = eG - eT;
  const eM  = cu > 0 ? (eN / cu) * 100 : 0;
  let rev = 0, pfee = 0, gross = 0, taxAmt = 0, net = 0;
  (item.sales || []).forEach(s => {
    const r  = (parseFloat(s.price) || 0) + (parseFloat(s.shipCharged) || 0);
    const pf = r * (PLATFORMS[s.channel || item.channel]?.fee || 0);
    const g  = r - pf - (parseFloat(s.shipCost) || 0) - (parseFloat(s.packCost) || 0) - cu;
    const t  = g > 0 ? g * TAX : 0;
    rev += r; pfee += pf; gross += g; taxAmt += t; net += (g - t);
  });
  return { cu, lp, fee, eG, eT, eN, eM, rev, pfee, gross, taxAmt, net, totalCostIn: parseFloat(item.costTotal) || 0 };
}

// ── Seed (Invoice #1410243-312676-1) ─────────────────────
function buildSeed() {
  const rows = [
    ["Siemens 1FK7034-2AK74-1SH0 Servo Motor NEW SEALED","SIE-1FK7034","Servo Motors","ns","10,110,160,210,288",1635,294.30,170.10,1,1,1,1350,5,"NEW SEALED · 12 LBS each"],
    ["Siemens 1FK7064-4CH7 Simotics Motor 40 LBS","SIE-1FK7064","Servo Motors","uw","120,200",400,72,41.62,1,5,1,750,2,"40 LBS · floor"],
    ["Siemens 1FK7086-4CF7 Simotics Motor 60 LBS","SIE-1FK7086","Servo Motors","uw","150,170",480,86.40,49.94,1,5,2,1100,2,"60 LBS · floor · freight req."],
    ["Siemens 1FT7044-1AF71 Servo Motor 20 LBS","SIE-1FT7044","Servo Motors","uw","140",355,63.90,36.94,1,1,2,950,1,"20 LBS"],
    ["Siemens 6AV2124-0MC01-0AX0 TP1200 Comfort HMI","SIE-6AV2124","HMI / Panels","uw","41,93,117,138",1050,189,109.22,1,2,1,849,4,"12\" touch screen · high demand"],
    ["Siemens 6FC5303-1AF10-8AA0 SINUMERIK Operator Panel","SIE-6FC5303","HMI / Panels","uw","2,22,38,89",610,109.80,63.47,1,2,2,320,4,"CNC operator panel · 7 LBS each"],
    ["Siemens 6ES7 512-1SK01-0AB0 SIMATIC ET200SP F-CPU","SIE-6ES7512","Industrial Automation","uw","151",230,41.40,23.93,1,2,3,650,1,"with component 6ES7193"],
    ["Siemens 6SL3120-2TE15-0AD0 SINAMICS Double Motor Module 2×5A","SIE-6SL3120-2TE","Industrial Automation","uw","48,65,114,126,145,179,188,236",1975,355.50,205.55,1,3,1,380,16,"16 units · DC 510-720V"],
    ["Siemens 6SL3120-1TE23-0AD0 SINAMICS Single Motor Module 30A","SIE-6SL3120-1TE23","Industrial Automation","uw","326,339,351,366,382,391",1845,332.10,191.97,1,3,2,650,6,"IP DC 510-720V 36A"],
    ["Siemens 6SL3120-1TE21-8AD0 SINAMICS Single Motor Module 18A","SIE-6SL3120-1TE21","Industrial Automation","uw","372,388",605,108.90,62.97,1,3,3,580,2,"IP DC 510-720V 22A"],
    ["Siemens 6SL3040-1NB00-0AA0 SINUMERIK NX15.3 Extension","SIE-6SL3040-NB","Industrial Automation","uw","136,221,259",700,126,72.85,1,3,4,480,3,"Digital Outputs 24VDC"],
    ["Siemens 6SL3040-1NC00-0AA0 SINUMERIK NX10.3 Extension","SIE-6SL3040-NC","Industrial Automation","uw","198,277,378",835,150.30,86.88,1,4,1,430,3,"Digital Outputs 24VDC"],
    ["Siemens 6SL3100-1DE22-0AA1 SINAMICS Control Supply Module","SIE-6SL3100","Industrial Automation","uw","292",130,23.40,13.53,1,4,2,420,1,""],
    ["Hirschmann OS20-002800T5T5T5 Managed IP67 Ethernet Switch","HIR-OS20","Network Equipment","uw","31,46,74,124",555,99.90,57.77,1,4,3,380,4,"IP67 rated · 10 LBS each"],
    ["Siemens 3VA5260-6ED31-0AA0 Circuit Breaker 60A 800V","SIE-3VA5260","Circuit Breakers","uw","11,29,45,73,99,123,186,219,239,345",1960,352.80,204.00,1,4,4,110,10,"5 LBS each"],
    ["Siemens 3VA5195-6ED31-0AA0 Circuit Breaker 15A 3-Pole","SIE-3VA5195","Circuit Breakers","uw","82,116,129,161,199,261,272,284,297,311",420,75.60,43.71,1,4,5,65,12,"with rotary operator"],
    ["Siemens 3VA5210-6ED31-0AA0 Circuit Breaker 100A 800V","SIE-3VA5210","Circuit Breakers","uw","143,165,204",500,90,52.03,1,5,3,185,3,"5-6 LBS each"],
    ["Siemens 5SJ4xxx Circuit Breakers Assorted (lots of 35)","SIE-5SJ4-LOT","Circuit Breakers","uw","57,83,106,201,302",405,72.90,42.14,1,5,4,140,5,"5 lots of 35 breakers"],
    ["Panduit VS-AVT-C08-L10 VeriSafe Voltage Tester","PAN-VSAVT","Safety Components","ns","7,51,69,96,153,173,222",175,31.50,18.21,1,1,3,290,16,"~16 testers · HIGH unit value"],
    ["Pilz PNOZ X2.8P Safety Relay 24VAC/DC (lots of 4)","PIL-PNOZ","Safety Components","uw","26,42,68,118,162,182,202,217,237,273",580,104.40,60.34,1,1,4,180,40,"10 lots of 4 = 40 relays"],
    ["Siemens 3RV2742 SIRIUS Motor Controller","SIE-3RV2742","Industrial Automation","uw","125,144,167,187,223,241,299,365",540,97.20,56.19,1,2,4,120,24,"8 lots of 3 = 24 pcs"],
    ["Marathon EPBCP84 Power Distribution Block 760A","MAR-EPBCP84","Power Supplies","uw","9,28,44,72,122,142,164,185",805,144.90,83.78,1,5,5,55,24,"8 lots of 3 = 24 blocks"],
    ["Anybus AB7658-F Profinet IO Slave-CANopen","ANY-AB7658","Network Equipment","uw","52,79",285,51.30,29.66,1,2,5,220,4,"2 lots of 2 = 4 units"],
    ["SOLA / Murr / Siemens Power Supplies Mixed","PSU-MIXED","Power Supplies","uw","8,27,71,156,184",205,36.90,21.33,1,3,5,95,5,"5 lots various models"],
    ["SICK / Banner / Keyence / Misc Industrial Sensors","MISC-SENSORS","Industrial Automation","uw","12,53,54,61,81,128,148",815,146.70,84.82,1,4,5,150,1,"Mixed · research each before listing"],
  ];
  return rows.map((r, i) => {
    const [name,sku,cat,cond,lots,bid,prem,ship,rack,shelf,pos,listP,qty,note] = r;
    const total = bid + prem + ship;
    return {
      id: "MP-" + String(i + 1).padStart(3, "0"),
      name, sku, cat, cond, qty, qtyInStock: qty, qtySold: 0,
      supplier: "Michigan Industrial Auctions",
      invoice: "1410243-312676-1", lots,
      bought: "2026-04-22", received: "2026-04-29", listed: "",
      rack, shelf, pos, notes: note,
      channel: "ebay", listP, listUrl: "",
      costTotal: total, costUnit: Math.round(total / qty * 100) / 100,
      status: "received", sales: [],
    };
  });
}

// ── Shared UI atoms ───────────────────────────────────────
function TInput({ val, set, type, ph, ro }) {
  return (
    <input
      readOnly={ro} type={type || "text"} value={val ?? ""} placeholder={ph || ""}
      onChange={e => set && set(e.target.value)}
      style={{ width: "100%", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none", background: ro ? "#f8f8f8" : "#fff", boxSizing: "border-box", fontFamily: "inherit" }}
    />
  );
}

function TSelect({ val, set, options }) {
  return (
    <select value={val} onChange={e => set(e.target.value)}
      style={{ width: "100%", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, background: "#fff", outline: "none", fontFamily: "inherit" }}>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

function TBtn({ click, children, color, sm, full, disabled }) {
  const colors = {
    dark:   { bg: "#1a1a2e", fg: "#fff" },
    green:  { bg: "#16a34a", fg: "#fff" },
    red:    { bg: "#dc2626", fg: "#fff" },
    amber:  { bg: "#f59e0b", fg: "#000" },
    gray:   { bg: "#f3f4f6", fg: "#374151" },
    white:  { bg: "#fff",    fg: "#374151", border: "1px solid #d1d5db" },
    blue:   { bg: "#2563eb", fg: "#fff" },
    purple: { bg: "#7c3aed", fg: "#fff" },
  };
  const s = colors[color || "dark"];
  return (
    <button onClick={click} disabled={disabled}
      style={{ padding: sm ? "5px 12px" : "9px 18px", border: s.border || "none", borderRadius: 8, background: disabled ? "#e5e7eb" : s.bg, color: disabled ? "#9ca3af" : s.fg, fontSize: sm ? 11 : 13, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", fontFamily: "inherit", width: full ? "100%" : "auto", whiteSpace: "nowrap" }}>
      {children}
    </button>
  );
}

function StatusTag({ status }) {
  const s = ST[status] || ST.purchased;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: s.bg, color: s.c, whiteSpace: "nowrap" }}>
      {s.icon} {s.l}
    </span>
  );
}

function FieldRow({ label, val, bold, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "0.5px solid #f3f4f6", fontSize: 13, fontWeight: bold ? 700 : 400 }}>
      <span style={{ color: "#6b7280" }}>{label}</span>
      <span style={{ color: color || "#111" }}>{val}</span>
    </div>
  );
}

function FGroup({ label, children, note }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>{label}</label>
      {children}
      {note && <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{note}</div>}
    </div>
  );
}

function PLSummary({ item, overrideSale }) {
  const c = calcPL(item);
  const isSold = overrideSale || (item.status === "sold" && (item.sales || []).length > 0);
  return (
    <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "12px 14px", fontSize: 13 }}>
      <div style={{ fontWeight: 700, fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
        {isSold ? "💰 Actual P&L" : "📊 Projected P&L"}
      </div>
      <FieldRow label="Cost / Unit" val={money(c.cu)} color="#dc2626" />
      <FieldRow label="List Price" val={money(c.lp)} />
      <FieldRow label={`Platform Fee (${PLATFORMS[item.channel]?.label})`} val={"-" + money(c.fee)} />
      <FieldRow label="Est. Net / Unit (after 28.5%)" val={money(c.eN)} color={c.eN >= 0 ? "#16a34a" : "#dc2626"} bold />
      <FieldRow label="Est. Margin on Cost" val={pct(c.eM)} color={c.eM >= 120 ? "#16a34a" : c.eM >= 50 ? "#d97706" : "#dc2626"} />
      {(item.sales || []).length > 0 && (
        <>
          <div style={{ borderTop: "1px dashed #e2e8f0", margin: "6px 0" }} />
          <FieldRow label={`Revenue (${item.qtySold} sold)`} val={money(c.rev)} color="#16a34a" />
          <FieldRow label="Net Profit (after 28.5%)" val={money(c.net)} bold color={c.net >= 0 ? "#16a34a" : "#dc2626"} />
        </>
      )}
    </div>
  );
}

// ── SELL MODAL ────────────────────────────────────────────
function SellModal({ item, onClose, onSave }) {
  const [date, setDate]               = useState(today());
  const [channel, setChannel]         = useState(item.channel || "ebay");
  const [price, setPrice]             = useState("");
  const [shipCharged, setShipCharged] = useState("");
  const [shipCost, setShipCost]       = useState("");
  const [packCost, setPackCost]       = useState("");

  const rev   = (parseFloat(price) || 0) + (parseFloat(shipCharged) || 0);
  const pf    = rev * (PLATFORMS[channel]?.fee || 0);
  const gross = rev - pf - (parseFloat(shipCost) || 0) - (parseFloat(packCost) || 0) - item.costUnit;
  const tax   = gross > 0 ? gross * TAX : 0;
  const net   = gross - tax;

  function confirm() {
    if (!price) { alert("Enter sale price"); return; }
    const sale = { date, channel, price: parseFloat(price), shipCharged: parseFloat(shipCharged) || 0, shipCost: parseFloat(shipCost) || 0, packCost: parseFloat(packCost) || 0 };
    const newInStock = Math.max(0, (item.qtyInStock || 0) - 1);
    onSave({ ...item, sales: [...(item.sales || []), sale], qtySold: (item.qtySold || 0) + 1, qtyInStock: newInStock, status: newInStock === 0 ? "sold" : item.status, listed: item.listed || today() });
    onClose();
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 900, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 480, padding: 24, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>✅ Record Sale</div>
        <div style={{ fontSize: 13, color: "#888", marginBottom: 12 }}>{item.id} — {item.name}</div>
        <div style={{ background: "#f8fafc", borderRadius: 8, padding: "8px 12px", marginBottom: 14, fontSize: 12, color: "#555" }}>
          Cost/unit: <strong>{money(item.costUnit)}</strong> · Location: <strong style={{ fontFamily: "monospace" }}>{loc(item)}</strong> · After sale: <strong style={{ color: item.qtyInStock - 1 === 0 ? "#dc2626" : "#16a34a" }}>{Math.max(0, item.qtyInStock - 1)} remain</strong>
          {item.qtyInStock - 1 === 0 && <span style={{ color: "#dc2626", fontWeight: 700 }}> — shelf free!</span>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          <FGroup label="Sale Date"><TInput val={date} set={setDate} type="date" /></FGroup>
          <FGroup label="Channel"><TSelect val={channel} set={setChannel} options={Object.entries(PLATFORMS).map(([k, v]) => [k, `${v.label} (${(v.fee * 100).toFixed(1)}%)`])} /></FGroup>
          <FGroup label="Sale Price *"><TInput val={price} set={setPrice} type="number" ph="0.00" /></FGroup>
          <FGroup label="Shipping Charged to Buyer"><TInput val={shipCharged} set={setShipCharged} type="number" ph="0.00" /></FGroup>
          <FGroup label="Your Shipping Cost"><TInput val={shipCost} set={setShipCost} type="number" ph="0.00" /></FGroup>
          <FGroup label="Packaging Cost"><TInput val={packCost} set={setPackCost} type="number" ph="0.00" /></FGroup>
        </div>
        <div style={{ background: net >= 0 ? "#f0fdf4" : "#fef2f2", border: `1px solid ${net >= 0 ? "#86efac" : "#fca5a5"}`, borderRadius: 8, padding: "10px 14px", marginBottom: 14 }}>
          <FieldRow label="Revenue" val={money(rev)} color="#16a34a" />
          <FieldRow label="Platform Fee" val={"-" + money(pf)} color="#dc2626" />
          <FieldRow label="Cost of Unit" val={"-" + money(item.costUnit)} color="#dc2626" />
          <FieldRow label="Gross Profit" val={money(gross)} bold />
          <FieldRow label="S-Corp Tax (~28.5%)" val={"-" + money(tax)} color="#dc2626" />
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px", background: net >= 0 ? "#dcfce7" : "#fee2e2", borderRadius: 6, marginTop: 6, fontWeight: 800, fontSize: 15 }}>
            <span>NET PROFIT</span>
            <span style={{ color: net >= 0 ? "#16a34a" : "#dc2626" }}>{money(net)}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <TBtn click={confirm} color="green" full>✅ Confirm Sale</TBtn>
          <TBtn click={onClose} color="gray">Cancel</TBtn>
        </div>
      </div>
    </div>
  );
}

// ── EDIT / ADD MODAL ──────────────────────────────────────
function EditModal({ item, onClose, onSave }) {
  const [f, setF] = useState({ ...item });
  function upd(k) { return v => setF(x => ({ ...x, [k]: v })); }
  const c = calcPL(f);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 900, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "16px", overflowY: "auto" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 660, padding: 24, margin: "auto" }}>
        <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 16 }}>
          {item.id ? (item._isDuplicate ? "⧉ Duplicate — " : "✏️ Edit — ") + item.id : "➕ Add New Item"}
        </div>

        {/* Product */}
        <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: "1px solid #e5e7eb", paddingBottom: 6, marginBottom: 12 }}>Product</div>
        <FGroup label="Product Name *"><TInput val={f.name} set={upd("name")} ph="e.g. Siemens 6AV2124 TP1200 HMI" /></FGroup>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}><FGroup label="SKU / Model"><TInput val={f.sku} set={upd("sku")} /></FGroup></div>
          <div style={{ flex: 1 }}><FGroup label="Category"><TSelect val={f.cat} set={upd("cat")} options={CATS.map(c => [c, c])} /></FGroup></div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}><FGroup label="Condition"><TSelect val={f.cond} set={upd("cond")} options={Object.entries(COND).map(([k, v]) => [k, v])} /></FGroup></div>
          <div style={{ flex: 1 }}><FGroup label="Status"><TSelect val={f.status} set={upd("status")} options={Object.entries(ST).map(([k, v]) => [k, v.icon + " " + v.l])} /></FGroup></div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}><FGroup label="Total Qty"><TInput val={f.qty} set={upd("qty")} type="number" /></FGroup></div>
          <div style={{ flex: 1 }}><FGroup label="Qty In Stock"><TInput val={f.qtyInStock} set={upd("qtyInStock")} type="number" /></FGroup></div>
        </div>

        {/* Location — NUMBERS ONLY */}
        <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: "1px solid #e5e7eb", paddingBottom: 6, marginBottom: 12, marginTop: 16 }}>📍 Location (Numbers Only)</div>
        <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 7, padding: "8px 12px", marginBottom: 10, fontSize: 12, color: "#1e40af" }}>
          Code: <strong style={{ fontFamily: "monospace", fontSize: 14 }}>{f.rack || "?"}-{f.shelf || "?"}-{f.pos || "?"}</strong>
          &nbsp;=&nbsp; Rack {f.rack || "?"} · {SHELF_NAMES[f.shelf] || "Shelf " + (f.shelf || "?")} · Position {f.pos || "?"}
          {f.shelf == 5 && " 🏗 (Floor)"}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <FGroup label="Rack (1–7)">
              <TSelect val={String(f.rack || 1)} set={v => upd("rack")(parseInt(v))}
                options={Array.from({ length: RACKS }, (_, i) => [String(i + 1), "Rack " + (i + 1)])} />
            </FGroup>
          </div>
          <div style={{ flex: 1 }}>
            <FGroup label="Shelf (1=top · 5=floor)">
              <TSelect val={String(f.shelf || 1)} set={v => upd("shelf")(parseInt(v))}
                options={Object.entries(SHELF_NAMES).map(([k, v]) => [k, k + " — " + v])} />
            </FGroup>
          </div>
          <div style={{ flex: 1 }}>
            <FGroup label="Position"><TInput val={f.pos} set={v => upd("pos")(parseInt(v) || 1)} type="number" ph="1" /></FGroup>
          </div>
        </div>

        {/* Acquisition */}
        <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: "1px solid #e5e7eb", paddingBottom: 6, marginBottom: 12, marginTop: 16 }}>Acquisition</div>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}><FGroup label="Supplier"><TInput val={f.supplier} set={upd("supplier")} /></FGroup></div>
          <div style={{ flex: 1 }}><FGroup label="Invoice #"><TInput val={f.invoice} set={upd("invoice")} /></FGroup></div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}><FGroup label="Lot(s)"><TInput val={f.lots} set={upd("lots")} /></FGroup></div>
          <div style={{ flex: 1 }}><FGroup label="Purchase Date"><TInput val={f.bought} set={upd("bought")} type="date" /></FGroup></div>
          <div style={{ flex: 1 }}><FGroup label="Received Date"><TInput val={f.received} set={upd("received")} type="date" /></FGroup></div>
        </div>

        {/* Pricing */}
        <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: "1px solid #e5e7eb", paddingBottom: 6, marginBottom: 12, marginTop: 16 }}>Pricing</div>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}><FGroup label="Total Cost"><TInput val={f.costTotal} set={upd("costTotal")} type="number" /></FGroup></div>
          <div style={{ flex: 1 }}><FGroup label="Cost / Unit"><TInput val={f.costUnit} set={upd("costUnit")} type="number" /></FGroup></div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}><FGroup label="List Price"><TInput val={f.listP} set={upd("listP")} type="number" /></FGroup></div>
          <div style={{ flex: 1 }}><FGroup label="Channel"><TSelect val={f.channel} set={upd("channel")} options={Object.entries(PLATFORMS).map(([k, v]) => [k, v.label])} /></FGroup></div>
        </div>
        <FGroup label="Listing URL"><TInput val={f.listUrl} set={upd("listUrl")} ph="https://www.ebay.com/itm/..." /></FGroup>

        {/* Live P&L */}
        <div style={{ background: c.eN >= 0 ? "#f0fdf4" : "#fef2f2", border: `1px solid ${c.eN >= 0 ? "#86efac" : "#fca5a5"}`, borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 13 }}>
          <span style={{ fontWeight: 600 }}>Est. Net/Unit (28.5% tax): </span>
          <span style={{ fontWeight: 800, color: c.eN >= 0 ? "#16a34a" : "#dc2626" }}>{money(c.eN)}</span>
          <span style={{ color: "#888", marginLeft: 12 }}>Margin: {pct(c.eM)}</span>
        </div>

        <FGroup label="Notes">
          <textarea value={f.notes || ""} onChange={e => upd("notes")(e.target.value)}
            style={{ width: "100%", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, minHeight: 60, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", outline: "none" }} />
        </FGroup>

        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <TBtn click={() => { if (!f.name.trim()) { alert("Product name required"); return; } onSave(f); }} color="dark">💾 Save</TBtn>
          <TBtn click={onClose} color="gray">Cancel</TBtn>
        </div>
      </div>
    </div>
  );
}

// ── DETAIL DRAWER ─────────────────────────────────────────
function Drawer({ item, onClose, onEdit, onSell, onDup }) {
  const c = calcPL(item);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 800, display: "flex", justifyContent: "flex-end" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#fff", width: "100%", maxWidth: 400, height: "100%", overflowY: "auto", padding: 24, boxShadow: "-4px 0 24px rgba(0,0,0,0.12)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div>
            <div style={{ fontFamily: "monospace", fontSize: 22, fontWeight: 900, color: "#1a1a2e" }}>{item.id}</div>
            <StatusTag status={item.status} />
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", fontSize: 22, cursor: "pointer", color: "#bbb" }}>✕</button>
        </div>

        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, lineHeight: 1.3 }}>{item.name}</div>

        {/* Unit count */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
          {[["📦 Stock", item.qtyInStock, "#1d4ed8", "#dbeafe"], ["✅ Sold", item.qtySold, "#16a34a", "#dcfce7"], ["📋 Total", item.qty, "#374151", "#f3f4f6"]].map(([l, n, c, bg]) => (
            <div key={l} style={{ textAlign: "center", background: bg, borderRadius: 8, padding: "8px 4px" }}>
              <div style={{ fontSize: 10, color: "#6b7280" }}>{l}</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: c }}>{n}</div>
            </div>
          ))}
        </div>

        {/* Location — NUMBERS ONLY */}
        <div style={{ background: "#1a1a2e", borderRadius: 10, padding: "12px 16px", marginBottom: 14, display: "flex", gap: 14, alignItems: "center" }}>
          <div style={{ fontSize: 28 }}>📍</div>
          <div>
            <div style={{ fontSize: 10, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em" }}>Location</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#f59e0b", fontFamily: "monospace" }}>{loc(item)}</div>
            <div style={{ fontSize: 11, color: "#9ca3af" }}>{locFull(item)}</div>
          </div>
        </div>

        {[["SKU", item.sku], ["Supplier", item.supplier], ["Invoice", item.invoice], ["Lots", item.lots], ["Purchased", item.bought], ["Received", item.received]].map(([l, v]) =>
          v ? <FieldRow key={l} label={l} val={v} /> : null
        )}
        {item.notes && <div style={{ background: "#f8fafc", borderRadius: 6, padding: "8px 10px", fontSize: 12, color: "#555", marginTop: 8, lineHeight: 1.5 }}>{item.notes}</div>}

        <div style={{ marginTop: 14 }}>
          <PLSummary item={item} />
        </div>

        {(item.sales || []).length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: "#374151", marginBottom: 8 }}>Sales History</div>
            {item.sales.map((s, i) => {
              const r  = (parseFloat(s.price) || 0) + (parseFloat(s.shipCharged) || 0);
              const pf = r * (PLATFORMS[s.channel || item.channel]?.fee || 0);
              const g  = r - pf - (parseFloat(s.shipCost) || 0) - (parseFloat(s.packCost) || 0) - item.costUnit;
              const n  = g - (g > 0 ? g * TAX : 0);
              return (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "6px 10px", background: i % 2 ? "#fafafa" : "#fff", borderRadius: 6, marginBottom: 3 }}>
                  <span style={{ color: "#888" }}>{s.date} · {money(s.price)}</span>
                  <span style={{ fontWeight: 700, color: n >= 0 ? "#16a34a" : "#dc2626" }}>{money(n)} net</span>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 20, flexWrap: "wrap" }}>
          {item.qtyInStock > 0 && <TBtn click={onSell} color="green">✅ Record Sale</TBtn>}
          <TBtn click={onEdit} color="white">✏️ Edit</TBtn>
          <TBtn click={onDup} color="purple">⧉ Duplicate</TBtn>
        </div>
      </div>
    </div>
  );
}

// ── WAREHOUSE MAP ─────────────────────────────────────────
function WarehouseMap({ items, onSelect }) {
  return (
    <div>
      <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#1e40af" }}>
        <strong>Location format: Rack – Shelf – Position (all numbers)</strong> · Rack 1–7 · Shelf 1=top, 5=Floor · Currently active: Rack 1
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
        {Array.from({ length: RACKS }, (_, ri) => ri + 1).map(rack => {
          const rItems = items.filter(i => Number(i.rack) === rack);
          const active = rItems.length > 0;
          return (
            <div key={rack} style={{ background: active ? "#fff" : "#fafafa", border: "1px solid " + (active ? "#e5e7eb" : "#f3f4f6"), borderRadius: 10, overflow: "hidden", opacity: active ? 1 : 0.5 }}>
              <div style={{ background: active ? "#1a1a2e" : "#9ca3af", color: "#fff", padding: "8px 14px", display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>RACK {rack}</span>
                <span style={{ fontSize: 11, color: "#9ca3af" }}>{active ? rItems.length + " products" : "Future rack"}</span>
              </div>
              {[1, 2, 3, 4, 5].map(shelf => {
                const shItems = items.filter(i => Number(i.rack) === rack && Number(i.shelf) === shelf);
                const isFloor = shelf === 5;
                return (
                  <div key={shelf} style={{ display: "flex", gap: 4, padding: "4px 8px", borderBottom: "0.5px solid #f3f4f6", alignItems: "stretch", background: isFloor ? "#faf5eb" : "transparent" }}>
                    <div style={{ width: 30, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: isFloor ? "#92400e" : "#9ca3af", background: isFloor ? "#fef3c7" : "#f8fafc", borderRadius: 4, flexShrink: 0, border: "1px solid " + (isFloor ? "#fcd34d" : "#f3f4f6") }}>
                      {isFloor ? "▣" : shelf}
                    </div>
                    <div style={{ flex: 1, display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {shItems.length > 0 ? shItems.map(item => (
                        <div key={item.id} onClick={() => onSelect(item.id)}
                          style={{ minWidth: 80, flex: 1, borderRadius: 6, padding: "4px 6px", cursor: "pointer", border: "1px solid", background: item.qtyInStock === 0 ? "#f0fdf4" : item.status === "listed" ? "#fef3c7" : "#eff6ff", borderColor: item.qtyInStock === 0 ? "#86efac" : item.status === "listed" ? "#fcd34d" : "#bfdbfe" }}>
                          <div style={{ fontSize: 9, fontWeight: 900, color: "#1a1a2e" }}>{item.id}</div>
                          <div style={{ fontSize: 10, color: "#374151", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 }}>{item.name.split(" ").slice(0, 3).join(" ")}</div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                            <span style={{ fontSize: 9, color: item.qtyInStock <= 2 ? "#dc2626" : "#6b7280", fontWeight: 700 }}>×{item.qtyInStock}</span>
                            <span style={{ fontSize: 9, color: item.qtySold > 0 ? "#16a34a" : "#9ca3af", fontWeight: 700 }}>{item.qtySold}✅</span>
                          </div>
                        </div>
                      )) : (
                        <div style={{ flex: 1, background: "#fafafa", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 44, border: "1px dashed #e5e7eb" }}>
                          <span style={{ fontSize: 10, color: "#d1d5db" }}>{rack}-{shelf} free</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── DEPLOY GUIDE ──────────────────────────────────────────
function DeployGuide() {
  const [sec, setSec] = useState("web");
  const tabs = [["web", "🌐 Website"], ["mobile", "📱 Mobile App"], ["costs", "💰 Costs"]];
  return (
    <div>
      <div style={{ background: "#1a1a2e", borderRadius: 10, padding: "18px 20px", marginBottom: 20, color: "#fff" }}>
        <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 6 }}>🚀 Deploy MP ERP — Outside Claude</div>
        <div style={{ fontSize: 13, color: "#9ca3af", lineHeight: 1.6 }}>
          This is a React app. To access it permanently from any browser or phone, follow the steps below. Total cost: <strong style={{ color: "#4ade80" }}>$0–$15/year</strong>.
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
        {tabs.map(([id, l]) => (
          <button key={id} onClick={() => setSec(id)}
            style={{ padding: "8px 16px", border: "1px solid", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", background: sec === id ? "#1a1a2e" : "#fff", color: sec === id ? "#fff" : "#374151", borderColor: sec === id ? "#1a1a2e" : "#e5e7eb" }}>
            {l}
          </button>
        ))}
      </div>

      {sec === "web" && (
        <div>
          <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#78350f" }}>
            <strong>Recommended: Vercel (free)</strong> — your app will be live in about 5 minutes. No credit card needed.
          </div>
          {[
            { n: 1, t: "Download the code from Claude", steps: ["Click the download button on this artifact (top right of the artifact window)", "Save the file as App.jsx on your computer"] },
            { n: 2, t: "Create a GitHub account (free)", steps: ["Go to github.com → Sign Up", "Create a new repository → name it mp-erp", "Upload your App.jsx file to the repository"] },
            { n: 3, t: "Create a Vite project (wraps the React app)", steps: ["Go to stackblitz.com or codesandbox.io (free online editors)", "Create new React + Vite project", "Paste your App.jsx content", "Click Share → this gives you a live URL immediately"] },
            { n: 4, t: "Deploy permanently on Vercel (free)", steps: ["Go to vercel.com → Sign Up with GitHub", "Click Add New Project → select your mp-erp repository", "Vercel detects React automatically → click Deploy", "In ~2 minutes you get: https://mp-erp.vercel.app", "Bookmark this URL — it works on any device"] },
            { n: 5, t: "Every update (new features from Claude)", steps: ["Download new version from Claude artifact", "Replace the file in your GitHub repository (drag and drop)", "Vercel automatically redeploys in under 1 minute"] },
          ].map(step => (
            <div key={step.n} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "16px 18px", marginBottom: 10 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#1a1a2e", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 14, flexShrink: 0 }}>{step.n}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{step.t}</div>
                  {step.steps.map((s, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, fontSize: 13, color: "#374151", marginBottom: 6 }}>
                      <span style={{ color: "#f59e0b", fontWeight: 700, flexShrink: 0 }}>→</span><span>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {sec === "mobile" && (
        <div>
          <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#166534" }}>
            <strong>✅ No App Store needed.</strong> Install directly from the browser to your phone home screen (PWA). Works offline. Feels like a native app.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {[
              { title: "📱 iPhone (Safari)", color: "#dbeafe", steps: ["Open Safari and go to your app URL (e.g. mp-erp.vercel.app)", "Tap the Share button (box with arrow, bottom center)", "Scroll down → tap Add to Home Screen", "Tap Add (top right)", "MP ERP icon appears on your home screen", "Opens fullscreen — no browser bar — like a native app"] },
              { title: "🤖 Android (Chrome)", color: "#dcfce7", steps: ["Open Chrome → go to your app URL", "Tap the 3-dot menu (⋮) top right", "Tap Add to Home Screen or Install App", "Tap Add to confirm", "Icon appears on your home screen", "Works offline — data saved locally on device"] },
            ].map(col => (
              <div key={col.title} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>{col.title}</div>
                {col.steps.map((s, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, fontSize: 13, marginBottom: 7 }}>
                    <span style={{ background: col.color, borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                    <span style={{ color: "#374151" }}>{s}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, padding: "12px 14px", marginTop: 14, fontSize: 13, color: "#78350f" }}>
            <strong>📸 Camera & barcode scan on phone:</strong> Once installed as PWA, Claude can add a QR/barcode scan feature using the phone camera in a future update — just ask.
          </div>
        </div>
      )}

      {sec === "costs" && (
        <div>
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden", marginBottom: 14 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Service", "Purpose", "Cost"].map(h => <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, fontSize: 11, color: "#6b7280", textTransform: "uppercase", borderBottom: "1px solid #e5e7eb" }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {[
                  ["GitHub", "Code storage + version control", "FREE"],
                  ["Vercel", "Web hosting + auto-deploy", "FREE (Hobby plan)"],
                  ["Domain name (optional)", "e.g. mpbusiness.app", "$10–15 / year"],
                  ["This React app (ERP)", "Already built by Claude", "FREE"],
                  ["eBay webhook auto-sync (future)", "100% automatic sales sync", "~$5/month"],
                ].map(([s, p, c], i) => (
                  <tr key={i} style={{ borderBottom: "0.5px solid #f3f4f6", background: i % 2 ? "#fafafa" : "#fff" }}>
                    <td style={{ padding: "10px 14px", fontWeight: 600 }}>{s}</td>
                    <td style={{ padding: "10px 14px", color: "#6b7280" }}>{p}</td>
                    <td style={{ padding: "10px 14px", fontWeight: 700, color: c === "FREE" ? "#16a34a" : "#111" }}>{c}</td>
                  </tr>
                ))}
                <tr style={{ borderTop: "2px solid #e5e7eb", background: "#f8fafc" }}>
                  <td colSpan={2} style={{ padding: "10px 14px", fontWeight: 700 }}>TOTAL to get started (no domain)</td>
                  <td style={{ padding: "10px 14px", fontWeight: 900, fontSize: 16, color: "#16a34a" }}>$0</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: "14px 16px", fontSize: 13, color: "#166534", lineHeight: 1.7 }}>
            <strong>🎯 Recommendation:</strong> Start with <strong>Vercel free + free subdomain</strong> (mp-erp.vercel.app) — zero cost, live in 5 minutes. When ready for a more professional look, add a custom domain ($15/year).
          </div>
        </div>
      )}
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────
export default function App() {
  const [items,    setItems]    = useState([]);
  const [tab,      setTab]      = useState("dashboard");
  const [detailId, setDetailId] = useState(null);
  const [sellId,   setSellId]   = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [search,   setSearch]   = useState("");
  const [stFilter, setStFilter] = useState("all");
  const [toast,    setToast]    = useState(null);
  const [loaded,   setLoaded]   = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get("mp_erp_v6");
        setItems(r?.value ? JSON.parse(r.value) : buildSeed());
      } catch {
        setItems(buildSeed());
      }
      setLoaded(true);
    })();
  }, []);

  async function persist(data) {
    setItems(data);
    try { await window.storage.set("mp_erp_v6", JSON.stringify(data)); } catch { }
  }

  function showToast(msg, ok) {
    setToast({ msg, ok: ok !== false });
    setTimeout(() => setToast(null), 3500);
  }

  function saveItem(updated) {
    const exists = items.find(i => i.id === updated.id);
    persist(exists ? items.map(i => i.id === updated.id ? updated : i) : [...items, updated]);
    setEditItem(null);
    setDetailId(null);
    showToast("✅ " + updated.id + " saved");
  }

  function saveSale(updated) {
    persist(items.map(i => i.id === updated.id ? updated : i));
    setSellId(null);
    showToast("✅ Sale recorded · " + updated.qtyInStock + " unit(s) remain");
  }

  function startNew() {
    setEditItem({ id: genId(items), name: "", sku: "", cat: "Industrial Automation", cond: "uw", qty: 1, qtyInStock: 1, qtySold: 0, supplier: "", invoice: "", lots: "", bought: today(), received: "", listed: "", rack: 1, shelf: 1, pos: 1, notes: "", channel: "ebay", listP: "", listUrl: "", costTotal: "", costUnit: "", status: "purchased", sales: [] });
    setDetailId(null);
  }

  function duplicateItem(item) {
    const copy = { ...item, id: genId(items), sales: [], qtySold: 0, status: "received", listed: "", _isDuplicate: true };
    setEditItem(copy);
    setDetailId(null);
    showToast("⧉ Duplicating " + item.id + " — edit and save as new item");
  }

  const detailItem = detailId ? items.find(i => i.id === detailId) : null;
  const sellItem   = sellId   ? items.find(i => i.id === sellId)   : null;

  const totalNet   = items.reduce((a, i) => a + calcPL(i).net, 0);
  const stockVal   = items.reduce((a, i) => a + calcPL(i).cu * (i.qtyInStock || 0), 0);
  const totalSold  = items.reduce((a, i) => a + (i.qtySold || 0), 0);
  const totalStock = items.reduce((a, i) => a + (i.qtyInStock || 0), 0);

  const filtered = items.filter(i => {
    if (stFilter !== "all" && i.status !== stFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return i.name.toLowerCase().includes(q) || i.id.toLowerCase().includes(q) || (i.sku || "").toLowerCase().includes(q) || (i.invoice || "").toLowerCase().includes(q);
    }
    return true;
  });

  const TABS = [
    { id: "dashboard", icon: "📊", label: "Dashboard" },
    { id: "inventory", icon: "📦", label: "Inventory" },
    { id: "map",       icon: "🗺",  label: "Warehouse" },
    { id: "analytics", icon: "📈", label: "Analytics"  },
    { id: "deploy",    icon: "🚀", label: "Deploy"     },
  ];

  if (!loaded) return <div style={{ padding: 60, textAlign: "center", color: "#888", fontSize: 16 }}>Loading MP ERP...</div>;

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, sans-serif", minHeight: "100vh", background: "#f4f5f7", color: "#111" }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999, background: toast.ok ? "#1a1a2e" : "#dc2626", color: "#fff", padding: "10px 20px", borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: "0 4px 24px rgba(0,0,0,0.3)", maxWidth: 340 }}>
          {toast.msg}
        </div>
      )}

      {/* Modals */}
      {sellItem  && <SellModal item={sellItem} onClose={() => setSellId(null)} onSave={saveSale} />}
      {editItem  && <EditModal item={editItem} onClose={() => setEditItem(null)} onSave={saveItem} />}
      {detailItem && !sellId && !editItem && (
        <Drawer item={detailItem} onClose={() => setDetailId(null)}
          onEdit={() => { setEditItem(detailItem); setDetailId(null); }}
          onSell={() => { setSellId(detailItem.id); setDetailId(null); }}
          onDup={() => duplicateItem(detailItem)} />
      )}

      {/* Header */}
      <div style={{ background: "#1a1a2e", color: "#fff", padding: "0 20px" }}>
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0 10px", flexWrap: "wrap", gap: 10 }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: "0.18em", color: "#6b7280", textTransform: "uppercase" }}>MP Business Strategy LLC · S-Corp · FL/SC</div>
              <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: "-0.02em" }}>Inventory + Warehouse ERP</div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{items.length} products · {totalStock} in stock · {totalSold} sold · Racks 1–7</div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button onClick={startNew} style={{ padding: "8px 16px", background: "#f59e0b", border: "none", borderRadius: 8, color: "#000", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>＋ Add Item</button>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase" }}>Net Profit (28.5%)</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#4ade80" }}>{money(totalNet)}</div>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", overflowX: "auto", borderTop: "1px solid #2d2d4e" }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{ padding: "10px 18px", background: "transparent", border: "none", color: tab === t.id ? "#fff" : "#6b7280", fontSize: 13, fontWeight: tab === t.id ? 700 : 400, cursor: "pointer", borderBottom: tab === t.id ? "2px solid #f59e0b" : "2px solid transparent", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 980, margin: "0 auto", padding: "20px 16px 60px" }}>

        {/* DASHBOARD */}
        {tab === "dashboard" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 20 }}>
              {[
                { l: "Net Profit (28.5%)", v: money(totalNet), s: totalSold + " units sold", c: "#16a34a", bg: "#f0fdf4" },
                { l: "Capital in Stock",   v: money(stockVal), s: totalStock + " units",     c: "#d97706", bg: "#fffbeb" },
                { l: "Products",           v: items.length,    s: "invoice #1410243",         c: "#2563eb", bg: "#eff6ff" },
                { l: "Tax Reserve (28.5%)",v: money(items.reduce((a, i) => a + calcPL(i).taxAmt, 0)), s: "S-Corp FL/SC est.", c: "#dc2626", bg: "#fef2f2" },
                { l: "Est. Potential",     v: money(items.reduce((a, i) => a + calcPL(i).eN * (i.qtyInStock || 0), 0)), s: "all at list price", c: "#7c3aed", bg: "#f5f3ff" },
              ].map((k, i) => (
                <div key={i} style={{ background: k.bg, border: "1px solid " + k.c + "22", borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{k.l}</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: k.c, marginBottom: 2 }}>{k.v}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>{k.s}</div>
                </div>
              ))}
            </div>
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ background: "#f8fafc", borderBottom: "1px solid #e5e7eb", padding: "12px 16px", fontWeight: 700, fontSize: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>📦 All Products</span>
                <TBtn click={() => setTab("inventory")} color="gray" sm>View Inventory →</TBtn>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      {["ID", "Product", "Location", "Stock", "Sold", "Est. Net/Unit", "Status"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, fontSize: 10, color: "#6b7280", textTransform: "uppercase", borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, i) => {
                      const c = calcPL(it);
                      return (
                        <tr key={it.id} onClick={() => setDetailId(it.id)}
                          style={{ borderBottom: "0.5px solid #f3f4f6", cursor: "pointer", background: i % 2 === 0 ? "#fff" : "#fafafa" }}
                          onMouseEnter={e => e.currentTarget.style.background = "#eff6ff"}
                          onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "#fff" : "#fafafa"}>
                          <td style={{ padding: "9px 12px", fontFamily: "monospace", fontWeight: 700, color: "#1a1a2e" }}>{it.id}</td>
                          <td style={{ padding: "9px 12px", fontWeight: 600, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</td>
                          <td style={{ padding: "9px 12px" }}><span style={{ fontFamily: "monospace", fontSize: 12, background: "#f3f4f6", padding: "2px 8px", borderRadius: 20, fontWeight: 700 }}>{loc(it)}</span></td>
                          <td style={{ padding: "9px 12px", textAlign: "center" }}><span style={{ background: it.qtyInStock === 0 ? "#dcfce7" : it.qtyInStock <= 2 ? "#fef3c7" : "#dbeafe", color: it.qtyInStock === 0 ? "#166534" : it.qtyInStock <= 2 ? "#92400e" : "#1d4ed8", padding: "2px 10px", borderRadius: 20, fontWeight: 700 }}>{it.qtyInStock}</span></td>
                          <td style={{ padding: "9px 12px", textAlign: "center" }}><span style={{ background: it.qtySold > 0 ? "#dcfce7" : "#f3f4f6", color: it.qtySold > 0 ? "#166534" : "#9ca3af", padding: "2px 10px", borderRadius: 20, fontWeight: 700 }}>{it.qtySold}</span></td>
                          <td style={{ padding: "9px 12px", fontWeight: 700, color: c.eN >= 0 ? "#16a34a" : "#dc2626" }}>{money(c.eN)}</td>
                          <td style={{ padding: "9px 12px" }}><StatusTag status={it.status} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* INVENTORY */}
        {tab === "inventory" && (
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍  Search by name, ID, SKU, invoice..."
                style={{ flex: 1, minWidth: 200, padding: "10px 14px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none", fontFamily: "inherit", background: "#fff" }} />
              <TSelect val={stFilter} set={setStFilter} options={[["all", "All Status"], ...Object.entries(ST).map(([k, v]) => [k, v.icon + " " + v.l])]} />
              <TBtn click={startNew} color="dark">＋ Add Item</TBtn>
            </div>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>{filtered.length} items · {totalStock} in stock · {totalSold} sold</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
              {filtered.map(item => {
                const c = calcPL(item);
                const days = item.received && item.status !== "sold" ? Math.ceil((new Date() - new Date(item.received)) / 86400000) : null;
                return (
                  <div key={item.id} onClick={() => setDetailId(item.id)}
                    style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, cursor: "pointer" }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 2px 16px rgba(0,0,0,0.08)"; e.currentTarget.style.borderColor = "#bfdbfe"; }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = "#e5e7eb"; }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <span style={{ fontFamily: "monospace", fontWeight: 900, fontSize: 14, color: "#1a1a2e" }}>{item.id}</span>
                      <StatusTag status={item.status} />
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.3, marginBottom: 8 }}>{item.name}</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                      <span style={{ fontSize: 10, background: "#f3f4f6", color: "#374151", padding: "2px 8px", borderRadius: 20, fontFamily: "monospace", fontWeight: 700 }}>📍 {loc(item)}</span>
                      {days != null && <span style={{ fontSize: 10, color: days > 60 ? "#dc2626" : days > 30 ? "#d97706" : "#16a34a" }}>⏱ {days}d</span>}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 10 }}>
                      {[{ l: "Stock", v: item.qtyInStock, c: "#2563eb", bg: "#dbeafe" }, { l: "Sold", v: item.qtySold, c: "#16a34a", bg: "#dcfce7" }, { l: "Est. Net", v: money(c.eN), c: c.eN >= 0 ? "#16a34a" : "#dc2626", bg: "#f8fafc" }].map((x, i) => (
                        <div key={i} style={{ background: x.bg, borderRadius: 6, padding: "5px 8px", textAlign: "center" }}>
                          <div style={{ fontSize: 9, color: "#6b7280", textTransform: "uppercase" }}>{x.l}</div>
                          <div style={{ fontWeight: 800, fontSize: 13, color: x.c }}>{x.v}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
                      {item.qtyInStock > 0 && <TBtn click={() => setSellId(item.id)} color="green" sm full>✅ Record Sale</TBtn>}
                      <TBtn click={() => duplicateItem(item)} color="purple" sm>⧉ Dup</TBtn>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* WAREHOUSE MAP */}
        {tab === "map" && <WarehouseMap items={items} onSelect={id => setDetailId(id)} />}

        {/* ANALYTICS */}
        {tab === "analytics" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 20 }}>
              {[
                { l: "Total Invested",   v: money(items.reduce((a, i) => a + calcPL(i).totalCostIn, 0)), c: "#dc2626" },
                { l: "Revenue (sold)",   v: money(items.reduce((a, i) => a + calcPL(i).rev, 0)),         c: "#16a34a" },
                { l: "Gross Profit",     v: money(items.reduce((a, i) => a + calcPL(i).gross, 0)),       c: "#d97706" },
                { l: "Tax Reserve",      v: money(items.reduce((a, i) => a + calcPL(i).taxAmt, 0)),      c: "#dc2626" },
                { l: "Net Profit",       v: money(totalNet),                                               c: "#16a34a" },
              ].map((k, i) => (
                <div key={i} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{k.l}</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: k.c }}>{k.v}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ background: "#f8fafc", borderBottom: "1px solid #e5e7eb", padding: "12px 16px", fontWeight: 700, fontSize: 14 }}>🏆 Best Margin / Unit</div>
                <div style={{ padding: "0 16px" }}>
                  {[...items].sort((a, b) => calcPL(b).eN - calcPL(a).eN).slice(0, 8).map((it, i) => {
                    const c = calcPL(it);
                    return (
                      <div key={it.id} onClick={() => setDetailId(it.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "0.5px solid #f3f4f6", cursor: "pointer" }}>
                        <div>
                          <span style={{ fontWeight: 900, color: "#f59e0b", marginRight: 6 }}>#{i + 1}</span>
                          <span style={{ fontWeight: 600 }}>{it.id}</span>
                          <div style={{ fontSize: 11, color: "#888" }}>{it.name.split(" ").slice(0, 4).join(" ")} · ×{it.qtyInStock}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontWeight: 800, color: c.eN >= 0 ? "#16a34a" : "#dc2626" }}>{money(c.eN)}</div>
                          <div style={{ fontSize: 11, color: c.eM >= 120 ? "#16a34a" : "#d97706" }}>{pct(c.eM)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ background: "#f8fafc", borderBottom: "1px solid #e5e7eb", padding: "12px 16px", fontWeight: 700, fontSize: 14 }}>⏱ Longest in Stock</div>
                <div style={{ padding: "0 16px" }}>
                  {[...items.filter(i => i.received && i.qtyInStock > 0)]
                    .map(i => ({ ...i, days: Math.ceil((new Date() - new Date(i.received)) / 86400000) }))
                    .sort((a, b) => b.days - a.days).slice(0, 8).map(it => (
                      <div key={it.id} onClick={() => setDetailId(it.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "0.5px solid #f3f4f6", cursor: "pointer" }}>
                        <div>
                          <span style={{ fontWeight: 600 }}>{it.id}</span>
                          <div style={{ fontSize: 11, color: "#888" }}>{it.name.split(" ").slice(0, 4).join(" ")}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontWeight: 800, color: it.days > 60 ? "#dc2626" : it.days > 30 ? "#d97706" : "#16a34a" }}>{it.days}d</div>
                          <div style={{ fontSize: 11, color: "#888" }}>×{it.qtyInStock} left</div>
                        </div>
                      </div>
                    ))}
                  <div style={{ background: "#fffbeb", borderRadius: 8, padding: "8px 12px", margin: "10px 0", fontSize: 12, color: "#78350f" }}>
                    💡 Items over 60 days: reduce price 10–15% to accelerate turnover.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* DEPLOY GUIDE */}
        {tab === "deploy" && <DeployGuide />}
      </div>
    </div>
  );
}
