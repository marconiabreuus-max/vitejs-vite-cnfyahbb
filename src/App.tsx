import { useState, useEffect } from “react”;

// ── Supabase cloud sync ───────────────────────────────────
const SB_URL = “https://fpjapzovpxwdvrsgosxe.supabase.co”;
const SB_KEY = “eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwamFwem92cHh3ZHZyc2dvc3hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MTA0NjQsImV4cCI6MjA5NDI4NjQ2NH0.xiO-OBQbh9gn8ZZbQn4jyAA3JBUyAySqNi2Y4IRhedk”;
const SB_H = {
“apikey”: SB_KEY,
“Authorization”: “Bearer “ + SB_KEY,
“Content-Type”: “application/json”,
“Prefer”: “resolution=merge-duplicates”,
};
async function cloudLoad() {
try {
const r = await fetch(SB_URL + “/rest/v1/inventory?id=eq.mp_erp_data&select=data”, { headers: SB_H });
const rows = await r.json();
return (rows && rows[0] && Array.isArray(rows[0].data)) ? rows[0].data : null;
} catch { return null; }
}
async function cloudSave(items) {
try {
await fetch(SB_URL + “/rest/v1/inventory”, {
method: “POST”,
headers: SB_H,
body: JSON.stringify([{ id: “mp_erp_data”, data: items }]),
});
} catch (e) { console.warn(“Cloud save error:”, e); }
}

// ── Constants ─────────────────────────────────────────────
const TAX = 0.285;
const RACKS = 7;
const SHELF_NAMES = { 1: “Shelf 1 (top)”, 2: “Shelf 2”, 3: “Shelf 3”, 4: “Shelf 4”, 5: “Floor” };
const PLATFORMS = {
ebay:    { label: “eBay”,          fee: 0.1325 },
amazon:  { label: “Amazon”,        fee: 0.15   },
shopify: { label: “Shopify”,       fee: 0.029  },
fb:      { label: “Facebook Mkt”,  fee: 0.05   },
direct:  { label: “Direct / Cash”, fee: 0      },
};
const CATS = [
“Industrial Automation”, “Servo Motors”, “HMI / Panels”, “Circuit Breakers”,
“Power Supplies”, “Safety Components”, “Network Equipment”, “Electronics”, “Other”,
];
const COND = {
ns: “New Sealed”, no: “New Open Box”, rf: “Refurbished”,
uw: “Used / Working”, uu: “Used / Untested”,
};
const ST = {
purchased: { l: “Purchased”, c: “#78716c”, bg: “#f5f5f4”, icon: “🛒” },
received:  { l: “In Stock”,  c: “#2563eb”, bg: “#dbeafe”, icon: “📦” },
listed:    { l: “Listed”,    c: “#d97706”, bg: “#fef3c7”, icon: “📢” },
sold:      { l: “Sold”,      c: “#16a34a”, bg: “#dcfce7”, icon: “✅” },
removed:   { l: “Removed”,   c: “#dc2626”, bg: “#fee2e2”, icon: “🗑” },
};

// ── Helpers ───────────────────────────────────────────────
function loc(item) {
if (!item.rack || !item.shelf) return “—”;
return item.pos ? item.rack + “-” + item.shelf + “-” + item.pos : item.rack + “-” + item.shelf;
}
function locFull(item) {
if (!item.rack || !item.shelf) return “No location”;
return “Rack “ + item.rack + “ · “ + (SHELF_NAMES[item.shelf] || “Shelf “ + item.shelf) + (item.pos ? “ · Pos “ + item.pos : “”);
}
function money(v) {
if (v == null || isNaN(v)) return “—”;
return (v < 0 ? “-$” : “$”) + Math.abs(v).toLocaleString(“en-US”, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function pct(v) { return (v == null || isNaN(v)) ? “—” : v.toFixed(1) + “%”; }
function today() { return new Date().toISOString().slice(0, 10); }
function genId(items) {
const nums = items.map(i => parseInt((i.id || “”).replace(“MP-”, “”), 10)).filter(n => !isNaN(n));
return “MP-” + String((nums.length ? Math.max(…nums) : 0) + 1).padStart(3, “0”);
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

// ── Seed ─────────────────────────────────────────────────
function buildSeed() {
const rows = [
[“Siemens 1FK7034-2AK74-1SH0 Servo Motor NEW SEALED”,“SIE-1FK7034”,“Servo Motors”,“ns”,“10,110,160,210,288”,1635,294.30,170.10,1,1,1,1350,5,“NEW SEALED 12 LBS each”],
[“Siemens 1FK7064-4CH7 Simotics Motor 40 LBS”,“SIE-1FK7064”,“Servo Motors”,“uw”,“120,200”,400,72,41.62,1,5,1,750,2,“40 LBS floor”],
[“Siemens 1FK7086-4CF7 Simotics Motor 60 LBS”,“SIE-1FK7086”,“Servo Motors”,“uw”,“150,170”,480,86.40,49.94,1,5,2,1100,2,“60 LBS floor freight req”],
[“Siemens 1FT7044-1AF71 Servo Motor 20 LBS”,“SIE-1FT7044”,“Servo Motors”,“uw”,“140”,355,63.90,36.94,1,1,2,950,1,“20 LBS”],
[“Siemens 6AV2124-0MC01-0AX0 TP1200 Comfort HMI”,“SIE-6AV2124”,“HMI / Panels”,“uw”,“41,93,117,138”,1050,189,109.22,1,2,1,849,4,“12in touch screen high demand”],
[“Siemens 6FC5303-1AF10-8AA0 SINUMERIK Operator Panel”,“SIE-6FC5303”,“HMI / Panels”,“uw”,“2,22,38,89”,610,109.80,63.47,1,2,2,320,4,“CNC operator panel 7 LBS each”],
[“Siemens 6ES7 512-1SK01-0AB0 SIMATIC ET200SP F-CPU”,“SIE-6ES7512”,“Industrial Automation”,“uw”,“151”,230,41.40,23.93,1,2,3,650,1,“with component 6ES7193”],
[“Siemens 6SL3120-2TE15-0AD0 SINAMICS Double Motor Module”,“SIE-6SL3120-2TE”,“Industrial Automation”,“uw”,“48,65,114,126,145,179,188,236”,1975,355.50,205.55,1,3,1,380,16,“16 units DC 510-720V”],
[“Siemens 6SL3120-1TE23-0AD0 SINAMICS Single Motor Module 30A”,“SIE-6SL3120-1TE23”,“Industrial Automation”,“uw”,“326,339,351,366,382,391”,1845,332.10,191.97,1,3,2,650,6,“IP DC 510-720V 36A”],
[“Siemens 6SL3120-1TE21-8AD0 SINAMICS Single Motor Module 18A”,“SIE-6SL3120-1TE21”,“Industrial Automation”,“uw”,“372,388”,605,108.90,62.97,1,3,3,580,2,“IP DC 510-720V 22A”],
[“Siemens 6SL3040-1NB00-0AA0 SINUMERIK NX15.3 Extension”,“SIE-6SL3040-NB”,“Industrial Automation”,“uw”,“136,221,259”,700,126,72.85,1,3,4,480,3,“Digital Outputs 24VDC”],
[“Siemens 6SL3040-1NC00-0AA0 SINUMERIK NX10.3 Extension”,“SIE-6SL3040-NC”,“Industrial Automation”,“uw”,“198,277,378”,835,150.30,86.88,1,4,1,430,3,“Digital Outputs 24VDC”],
[“Siemens 6SL3100-1DE22-0AA1 SINAMICS Control Supply Module”,“SIE-6SL3100”,“Industrial Automation”,“uw”,“292”,130,23.40,13.53,1,4,2,420,1,””],
[“Hirschmann OS20 Managed IP67 Ethernet Switch”,“HIR-OS20”,“Network Equipment”,“uw”,“31,46,74,124”,555,99.90,57.77,1,4,3,380,4,“IP67 rated 10 LBS each”],
[“Siemens 3VA5260-6ED31-0AA0 Circuit Breaker 60A 800V”,“SIE-3VA5260”,“Circuit Breakers”,“uw”,“11,29,45,73,99,123,186,219,239,345”,1960,352.80,204.00,1,4,4,110,10,“5 LBS each”],
[“Siemens 3VA5195-6ED31-0AA0 Circuit Breaker 15A 3-Pole”,“SIE-3VA5195”,“Circuit Breakers”,“uw”,“82,116,129,161,199,261,272,284,297,311”,420,75.60,43.71,1,4,5,65,12,“with rotary operator”],
[“Siemens 3VA5210-6ED31-0AA0 Circuit Breaker 100A 800V”,“SIE-3VA5210”,“Circuit Breakers”,“uw”,“143,165,204”,500,90,52.03,1,5,3,185,3,“5-6 LBS each”],
[“Siemens 5SJ4xxx Circuit Breakers Assorted lots of 35”,“SIE-5SJ4-LOT”,“Circuit Breakers”,“uw”,“57,83,106,201,302”,405,72.90,42.14,1,5,4,140,5,“5 lots of 35 breakers”],
[“Panduit VS-AVT-C08-L10 VeriSafe Voltage Tester”,“PAN-VSAVT”,“Safety Components”,“ns”,“7,51,69,96,153,173,222”,175,31.50,18.21,1,1,3,290,16,“16 testers HIGH unit value”],
[“Pilz PNOZ X2.8P Safety Relay 24VAC/DC lots of 4”,“PIL-PNOZ”,“Safety Components”,“uw”,“26,42,68,118,162,182,202,217,237,273”,580,104.40,60.34,1,1,4,180,40,“10 lots of 4 = 40 relays”],
[“Siemens 3RV2742 SIRIUS Motor Controller”,“SIE-3RV2742”,“Industrial Automation”,“uw”,“125,144,167,187,223,241,299,365”,540,97.20,56.19,1,2,4,120,24,“8 lots of 3 = 24 pcs”],
[“Marathon EPBCP84 Power Distribution Block 760A”,“MAR-EPBCP84”,“Power Supplies”,“uw”,“9,28,44,72,122,142,164,185”,805,144.90,83.78,1,5,5,55,24,“8 lots of 3 = 24 blocks”],
[“Anybus AB7658-F Profinet IO Slave-CANopen”,“ANY-AB7658”,“Network Equipment”,“uw”,“52,79”,285,51.30,29.66,1,2,5,220,4,“2 lots of 2 = 4 units”],
[“SOLA Murr Siemens Power Supplies Mixed”,“PSU-MIXED”,“Power Supplies”,“uw”,“8,27,71,156,184”,205,36.90,21.33,1,3,5,95,5,“5 lots various models”],
[“SICK Banner Keyence Misc Industrial Sensors”,“MISC-SENSORS”,“Industrial Automation”,“uw”,“12,53,54,61,81,128,148”,815,146.70,84.82,1,4,5,150,1,“Mixed research each before listing”],
];
return rows.map((r, i) => {
const [name, sku, cat, cond, lots, bid, prem, ship, rack, shelf, pos, listP, qty, note] = r;
const total = bid + prem + ship;
return {
id: “MP-” + String(i + 1).padStart(3, “0”),
name, sku, cat, cond, qty, qtyInStock: qty, qtySold: 0,
supplier: “Michigan Industrial Auctions”,
invoice: “1410243-312676-1”, lots,
bought: “2026-04-22”, received: “2026-04-29”, listed: “”,
rack, shelf, pos, notes: note,
channel: “ebay”, listP, listUrl: “”,
costTotal: total,
costUnit: Math.round(total / qty * 100) / 100,
status: “received”, sales: [],
};
});
}

// ── UI Atoms ──────────────────────────────────────────────
function TInput({ val, set, type, ph, ro }) {
return (
<input readOnly={ro} type={type || “text”} value={val ?? “”} placeholder={ph || “”}
onChange={e => set && set(e.target.value)}
style={{ width: “100%”, padding: “8px 10px”, border: “1px solid #e5e7eb”, borderRadius: 8, fontSize: 13, outline: “none”, background: ro ? “#f8f8f8” : “#fff”, boxSizing: “border-box”, fontFamily: “inherit” }} />
);
}
function TSelect({ val, set, options }) {
return (
<select value={val} onChange={e => set(e.target.value)}
style={{ width: “100%”, padding: “8px 10px”, border: “1px solid #e5e7eb”, borderRadius: 8, fontSize: 13, background: “#fff”, outline: “none”, fontFamily: “inherit” }}>
{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
</select>
);
}
function TBtn({ click, children, color, sm, full, disabled }) {
const C = {
dark:   { bg: “#1a1a2e”, fg: “#fff” },
green:  { bg: “#16a34a”, fg: “#fff” },
red:    { bg: “#dc2626”, fg: “#fff” },
amber:  { bg: “#f59e0b”, fg: “#000” },
gray:   { bg: “#f3f4f6”, fg: “#374151” },
white:  { bg: “#fff”,    fg: “#374151”, bd: “1px solid #d1d5db” },
blue:   { bg: “#2563eb”, fg: “#fff” },
purple: { bg: “#7c3aed”, fg: “#fff” },
};
const s = C[color || “dark”] || C.dark;
return (
<button onClick={click} disabled={disabled}
style={{ padding: sm ? “5px 12px” : “9px 18px”, border: s.bd || “none”, borderRadius: 8, background: disabled ? “#e5e7eb” : s.bg, color: disabled ? “#9ca3af” : s.fg, fontSize: sm ? 11 : 13, fontWeight: 600, cursor: disabled ? “not-allowed” : “pointer”, fontFamily: “inherit”, width: full ? “100%” : “auto”, whiteSpace: “nowrap” }}>
{children}
</button>
);
}
function STag({ status }) {
const s = ST[status] || ST.purchased;
return <span style={{ fontSize: 11, fontWeight: 700, padding: “3px 10px”, borderRadius: 20, background: s.bg, color: s.c, whiteSpace: “nowrap” }}>{s.icon} {s.l}</span>;
}
function FRow({ label, val, bold, color }) {
return (
<div style={{ display: “flex”, justifyContent: “space-between”, padding: “5px 0”, borderBottom: “0.5px solid #f3f4f6”, fontSize: 13, fontWeight: bold ? 700 : 400 }}>
<span style={{ color: “#6b7280” }}>{label}</span>
<span style={{ color: color || “#111” }}>{val}</span>
</div>
);
}
function FG({ label, children, note }) {
return (
<div style={{ marginBottom: 12 }}>
<label style={{ display: “block”, fontSize: 10, fontWeight: 700, color: “#6b7280”, textTransform: “uppercase”, letterSpacing: “0.07em”, marginBottom: 3 }}>{label}</label>
{children}
{note && <div style={{ fontSize: 10, color: “#9ca3af”, marginTop: 2 }}>{note}</div>}
</div>
);
}
function PLBox({ item }) {
const c = calcPL(item);
return (
<div style={{ background: “#f8fafc”, border: “1px solid #e2e8f0”, borderRadius: 8, padding: “12px 14px”, fontSize: 13 }}>
<div style={{ fontWeight: 700, fontSize: 10, color: “#64748b”, textTransform: “uppercase”, letterSpacing: “0.07em”, marginBottom: 8 }}>
{(item.sales || []).length > 0 ? “Actual P&L” : “Projected P&L”}
</div>
<FRow label="Cost / Unit" val={money(c.cu)} color="#dc2626" />
<FRow label="List Price" val={money(c.lp)} />
<FRow label={“Fee (” + (PLATFORMS[item.channel]?.label || “”) + “)”} val={”-” + money(c.fee)} />
<FRow label="Est. Net / Unit (28.5%)" val={money(c.eN)} color={c.eN >= 0 ? “#16a34a” : “#dc2626”} bold />
<FRow label="Est. Margin" val={pct(c.eM)} color={c.eM >= 120 ? “#16a34a” : c.eM >= 50 ? “#d97706” : “#dc2626”} />
{(item.sales || []).length > 0 && (
<>
<div style={{ borderTop: “1px dashed #e2e8f0”, margin: “6px 0” }} />
<FRow label={“Revenue (” + item.qtySold + “ sold)”} val={money(c.rev)} color=”#16a34a” />
<FRow label="Net Profit (after tax)" val={money(c.net)} bold color={c.net >= 0 ? “#16a34a” : “#dc2626”} />
</>
)}
</div>
);
}

// ── Sell Modal ────────────────────────────────────────────
function SellModal({ item, onClose, onSave }) {
const [dt, setDt] = useState(today());
const [ch, setCh] = useState(item.channel || “ebay”);
const [pr, setPr] = useState(””);
const [sc, setSc] = useState(””);
const [so, setSo] = useState(””);
const [pk, setPk] = useState(””);
const rev = (parseFloat(pr) || 0) + (parseFloat(sc) || 0);
const pf = rev * (PLATFORMS[ch]?.fee || 0);
const gross = rev - pf - (parseFloat(so) || 0) - (parseFloat(pk) || 0) - item.costUnit;
const tax = gross > 0 ? gross * TAX : 0;
const net = gross - tax;
function confirm() {
if (!pr) { alert(“Enter sale price”); return; }
const sale = { date: dt, channel: ch, price: parseFloat(pr), shipCharged: parseFloat(sc) || 0, shipCost: parseFloat(so) || 0, packCost: parseFloat(pk) || 0 };
const left = Math.max(0, (item.qtyInStock || 0) - 1);
onSave({ …item, sales: […(item.sales || []), sale], qtySold: (item.qtySold || 0) + 1, qtyInStock: left, status: left === 0 ? “sold” : item.status, listed: item.listed || today() });
onClose();
}
return (
<div style={{ position: “fixed”, inset: 0, background: “rgba(0,0,0,0.55)”, zIndex: 900, display: “flex”, alignItems: “center”, justifyContent: “center”, padding: 16 }}
onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
<div style={{ background: “#fff”, borderRadius: 14, width: “100%”, maxWidth: 480, padding: 24, maxHeight: “90vh”, overflowY: “auto” }}>
<div style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>Record Sale</div>
<div style={{ fontSize: 13, color: “#888”, marginBottom: 12 }}>{item.id} — {item.name}</div>
<div style={{ background: “#f8fafc”, borderRadius: 8, padding: “8px 12px”, marginBottom: 14, fontSize: 12, color: “#555” }}>
Cost/unit: <strong>{money(item.costUnit)}</strong> · Location: <strong style={{ fontFamily: “monospace” }}>{loc(item)}</strong> · After sale: <strong style={{ color: item.qtyInStock - 1 <= 0 ? “#dc2626” : “#16a34a” }}>{Math.max(0, item.qtyInStock - 1)} remain</strong>
</div>
<div style={{ display: “grid”, gridTemplateColumns: “1fr 1fr”, gap: 10, marginBottom: 14 }}>
<FG label="Sale Date"><TInput val={dt} set={setDt} type="date" /></FG>
<FG label="Platform"><TSelect val={ch} set={setCh} options={Object.entries(PLATFORMS).map(([k, v]) => [k, v.label + “ (” + (v.fee * 100).toFixed(1) + “%)”])} /></FG>
<FG label="Sale Price *"><TInput val={pr} set={setPr} type="number" ph="0.00" /></FG>
<FG label="Shipping Charged to Buyer"><TInput val={sc} set={setSc} type="number" ph="0.00" /></FG>
<FG label="Your Shipping Cost"><TInput val={so} set={setSo} type="number" ph="0.00" /></FG>
<FG label="Packaging Cost"><TInput val={pk} set={setPk} type="number" ph="0.00" /></FG>
</div>
<div style={{ background: net >= 0 ? “#f0fdf4” : “#fef2f2”, border: “1px solid “ + (net >= 0 ? “#86efac” : “#fca5a5”), borderRadius: 8, padding: “10px 14px”, marginBottom: 14 }}>
<FRow label="Revenue" val={money(rev)} color="#16a34a" />
<FRow label=“Platform Fee” val={”-” + money(pf)} color=”#dc2626” />
<FRow label=“Cost of Unit” val={”-” + money(item.costUnit)} color=”#dc2626” />
<FRow label="Gross Profit" val={money(gross)} bold />
<FRow label=“Tax (28.5% S-Corp)” val={”-” + money(tax)} color=”#dc2626” />
<div style={{ display: “flex”, justifyContent: “space-between”, padding: “8px”, background: net >= 0 ? “#dcfce7” : “#fee2e2”, borderRadius: 6, marginTop: 6, fontWeight: 800, fontSize: 15 }}>
<span>NET PROFIT</span>
<span style={{ color: net >= 0 ? “#16a34a” : “#dc2626” }}>{money(net)}</span>
</div>
</div>
<div style={{ display: “flex”, gap: 10 }}>
<TBtn click={confirm} color="green" full>Confirm Sale</TBtn>
<TBtn click={onClose} color="gray">Cancel</TBtn>
</div>
</div>
</div>
);
}

// ── Edit Modal ────────────────────────────────────────────
function EditModal({ item, onClose, onSave }) {
const [f, setF] = useState({ …item });
const upd = k => v => setF(x => ({ …x, [k]: v }));
const c = calcPL(f);
return (
<div style={{ position: “fixed”, inset: 0, background: “rgba(0,0,0,0.55)”, zIndex: 900, display: “flex”, alignItems: “flex-start”, justifyContent: “center”, padding: 16, overflowY: “auto” }}
onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
<div style={{ background: “#fff”, borderRadius: 14, width: “100%”, maxWidth: 660, padding: 24, margin: “auto” }}>
<div style={{ fontWeight: 800, fontSize: 17, marginBottom: 16 }}>{item._dup ? “Duplicate” : “Edit”} — {item.id}</div>

```
    <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: "1px solid #e5e7eb", paddingBottom: 6, marginBottom: 12 }}>Product</div>
    <FG label="Product Name *"><TInput val={f.name} set={upd("name")} ph="e.g. Siemens 6AV2124 TP1200 HMI" /></FG>
    <div style={{ display: "flex", gap: 10 }}>
      <div style={{ flex: 1 }}><FG label="SKU"><TInput val={f.sku} set={upd("sku")} /></FG></div>
      <div style={{ flex: 1 }}><FG label="Category"><TSelect val={f.cat} set={upd("cat")} options={CATS.map(c => [c, c])} /></FG></div>
    </div>
    <div style={{ display: "flex", gap: 10 }}>
      <div style={{ flex: 1 }}><FG label="Condition"><TSelect val={f.cond} set={upd("cond")} options={Object.entries(COND).map(([k, v]) => [k, v])} /></FG></div>
      <div style={{ flex: 1 }}><FG label="Status"><TSelect val={f.status} set={upd("status")} options={Object.entries(ST).map(([k, v]) => [k, v.icon + " " + v.l])} /></FG></div>
    </div>
    <div style={{ display: "flex", gap: 10 }}>
      <div style={{ flex: 1 }}><FG label="Total Qty"><TInput val={f.qty} set={upd("qty")} type="number" /></FG></div>
      <div style={{ flex: 1 }}><FG label="Qty In Stock"><TInput val={f.qtyInStock} set={upd("qtyInStock")} type="number" /></FG></div>
    </div>

    <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: "1px solid #e5e7eb", paddingBottom: 6, marginBottom: 12, marginTop: 16 }}>Location — Numbers Only</div>
    <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 7, padding: "8px 12px", marginBottom: 10, fontSize: 12, color: "#1e40af" }}>
      Code: <strong style={{ fontFamily: "monospace", fontSize: 14 }}>{f.rack || "?"}-{f.shelf || "?"}-{f.pos || "?"}</strong>
      {" = "} Rack {f.rack || "?"} · {SHELF_NAMES[f.shelf] || "Shelf"} · Pos {f.pos || "?"}
    </div>
    <div style={{ display: "flex", gap: 10 }}>
      <div style={{ flex: 1 }}>
        <FG label="Rack (1-7)">
          <TSelect val={String(f.rack || 1)} set={v => upd("rack")(parseInt(v))} options={Array.from({ length: RACKS }, (_, i) => [String(i + 1), "Rack " + (i + 1)])} />
        </FG>
      </div>
      <div style={{ flex: 1 }}>
        <FG label="Shelf (1=top, 5=floor)">
          <TSelect val={String(f.shelf || 1)} set={v => upd("shelf")(parseInt(v))} options={Object.entries(SHELF_NAMES).map(([k, v]) => [k, k + " — " + v])} />
        </FG>
      </div>
      <div style={{ flex: 1 }}>
        <FG label="Position">
          <TInput val={f.pos} set={v => upd("pos")(parseInt(v) || 1)} type="number" ph="1" />
        </FG>
      </div>
    </div>

    <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: "1px solid #e5e7eb", paddingBottom: 6, marginBottom: 12, marginTop: 16 }}>Acquisition</div>
    <div style={{ display: "flex", gap: 10 }}>
      <div style={{ flex: 1 }}><FG label="Supplier"><TInput val={f.supplier} set={upd("supplier")} /></FG></div>
      <div style={{ flex: 1 }}><FG label="Invoice #"><TInput val={f.invoice} set={upd("invoice")} /></FG></div>
    </div>
    <div style={{ display: "flex", gap: 10 }}>
      <div style={{ flex: 1 }}><FG label="Lot(s)"><TInput val={f.lots} set={upd("lots")} /></FG></div>
      <div style={{ flex: 1 }}><FG label="Purchase Date"><TInput val={f.bought} set={upd("bought")} type="date" /></FG></div>
      <div style={{ flex: 1 }}><FG label="Received Date"><TInput val={f.received} set={upd("received")} type="date" /></FG></div>
    </div>

    <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: "1px solid #e5e7eb", paddingBottom: 6, marginBottom: 12, marginTop: 16 }}>Pricing</div>
    <div style={{ display: "flex", gap: 10 }}>
      <div style={{ flex: 1 }}><FG label="Total Cost"><TInput val={f.costTotal} set={upd("costTotal")} type="number" /></FG></div>
      <div style={{ flex: 1 }}><FG label="Cost / Unit"><TInput val={f.costUnit} set={upd("costUnit")} type="number" /></FG></div>
    </div>
    <div style={{ display: "flex", gap: 10 }}>
      <div style={{ flex: 1 }}><FG label="List Price"><TInput val={f.listP} set={upd("listP")} type="number" /></FG></div>
      <div style={{ flex: 1 }}><FG label="Channel"><TSelect val={f.channel} set={upd("channel")} options={Object.entries(PLATFORMS).map(([k, v]) => [k, v.label])} /></FG></div>
    </div>
    <FG label="Listing URL"><TInput val={f.listUrl} set={upd("listUrl")} ph="https://www.ebay.com/itm/..." /></FG>

    <div style={{ background: c.eN >= 0 ? "#f0fdf4" : "#fef2f2", border: "1px solid " + (c.eN >= 0 ? "#86efac" : "#fca5a5"), borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 13 }}>
      Est. Net/Unit: <strong style={{ color: c.eN >= 0 ? "#16a34a" : "#dc2626" }}>{money(c.eN)}</strong>
      <span style={{ color: "#888", marginLeft: 12 }}>Margin: {pct(c.eM)}</span>
    </div>

    <FG label="Notes">
      <textarea value={f.notes || ""} onChange={e => upd("notes")(e.target.value)}
        style={{ width: "100%", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, minHeight: 60, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", outline: "none" }} />
    </FG>
    <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
      <TBtn click={() => { if (!f.name.trim()) { alert("Product name required"); return; } onSave(f); }} color="dark">Save</TBtn>
      <TBtn click={onClose} color="gray">Cancel</TBtn>
    </div>
  </div>
</div>
```

);
}

// ── Invoice Import Modal ──────────────────────────────────
function InvoiceModal({ existingItems, onClose, onImport }) {
const [step, setStep] = useState(1);
const [raw, setRaw] = useState(””);
const [parsed, setParsed] = useState([]);
const [loading, setLoading] = useState(false);
const [err, setErr] = useState(””);
const [sup, setSup] = useState(””);
const [invN, setInvN] = useState(””);
const [bd, setBd] = useState(today());
const [rd, setRd] = useState(””);

async function parseAI() {
if (!raw.trim()) { setErr(“Paste invoice text first”); return; }
setLoading(true); setErr(””);
try {
const prompt = [
“Parse this industrial auction invoice.”,
“Return ONLY a valid JSON array — no markdown, no explanation.”,
“Each object must have:”,
“name (full description, string),”,
“sku (model number, string),”,
“qty (quantity, number),”,
“bidPrice (bid price USD, number),”,
“premium (buyer premium USD, number — 0 if not shown),”,
“lotNumber (string),”,
“cat (choose from: Industrial Automation, Servo Motors, HMI / Panels, Circuit Breakers, Power Supplies, Safety Components, Network Equipment, Electronics, Other),”,
“listP (suggested eBay listing price USD, number).”,
“”,
“Invoice text:”,
raw,
“”,
“Return ONLY the JSON array.”,
].join(”\n”);

```
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  const text = (data.content || []).map(b => b.text || "").join("");
  const arr = JSON.parse(text.replace(/```json|```/g, "").trim());
  if (!Array.isArray(arr)) throw new Error("Not an array");
  setParsed(arr.map((it, i) => ({ ...it, selected: true, rack: 1, shelf: 1, pos: i + 1 })));
  setStep(2);
} catch (e) {
  setErr("Could not parse: " + e.message);
}
setLoading(false);
```

}

function tog(i) { setParsed(p => p.map((x, j) => j === i ? { …x, selected: !x.selected } : x)); }
function upd(i, k, v) { setParsed(p => p.map((x, j) => j === i ? { …x, [k]: v } : x)); }

function doImport() {
const sel = parsed.filter(x => x.selected);
const newItems = sel.map((it, i) => {
const total = (parseFloat(it.bidPrice) || 0) + (parseFloat(it.premium) || 0);
const qty = parseInt(it.qty) || 1;
return {
id: genId([…existingItems, …sel.slice(0, i)]),
name: it.name, sku: it.sku || “”, cat: it.cat || “Industrial Automation”, cond: “uw”,
qty, qtyInStock: qty, qtySold: 0,
supplier: sup, invoice: invN, lots: it.lotNumber || “”,
bought: bd, received: rd, listed: “”,
rack: parseInt(it.rack) || 1, shelf: parseInt(it.shelf) || 1, pos: parseInt(it.pos) || 1,
notes: “”, channel: “ebay”, listP: parseFloat(it.listP) || “”,
listUrl: “”, costTotal: total,
costUnit: qty > 0 ? Math.round(total / qty * 100) / 100 : total,
status: “purchased”, sales: [],
};
});
onImport(newItems);
onClose();
}

return (
<div style={{ position: “fixed”, inset: 0, background: “rgba(0,0,0,0.6)”, zIndex: 950, display: “flex”, alignItems: “flex-start”, justifyContent: “center”, padding: 16, overflowY: “auto” }}
onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
<div style={{ background: “#fff”, borderRadius: 14, width: “100%”, maxWidth: 680, padding: 24, margin: “auto” }}>
<div style={{ display: “flex”, gap: 0, marginBottom: 20 }}>
{[[“1”, “Paste Invoice”], [“2”, “Review Items”], [“3”, “Locations”]].map(([n, l], i) => (
<div key={n} style={{ display: “flex”, alignItems: “center”, flex: 1 }}>
<div style={{ display: “flex”, alignItems: “center”, gap: 6 }}>
<div style={{ width: 26, height: 26, borderRadius: “50%”, display: “flex”, alignItems: “center”, justifyContent: “center”, fontSize: 12, fontWeight: 700, background: step > i + 1 ? “#16a34a” : step === i + 1 ? “#1a1a2e” : “#e5e7eb”, color: step >= i + 1 ? “#fff” : “#9ca3af” }}>
{step > i + 1 ? “v” : n}
</div>
<span style={{ fontSize: 12, fontWeight: step === i + 1 ? 700 : 400, color: step === i + 1 ? “#1a1a2e” : “#9ca3af” }}>{l}</span>
</div>
{i < 2 && <div style={{ flex: 1, height: 1, background: “#e5e7eb”, margin: “0 8px” }} />}
</div>
))}
</div>

```
    {step === 1 && (
      <>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>Import Invoice — AI reads it for you</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 200 }}><FG label="Supplier"><TInput val={sup} set={setSup} ph="Michigan Industrial Auctions" /></FG></div>
          <div style={{ flex: 1, minWidth: 150 }}><FG label="Invoice Number"><TInput val={invN} set={setInvN} ph="1410243-312676-1" /></FG></div>
          <div style={{ flex: 1, minWidth: 140 }}><FG label="Purchase Date"><TInput val={bd} set={setBd} type="date" /></FG></div>
          <div style={{ flex: 1, minWidth: 140 }}><FG label="Expected Receive Date"><TInput val={rd} set={setRd} type="date" /></FG></div>
        </div>
        <FG label="Paste Invoice Text" note="Copy all text from the PDF and paste here — AI will extract all items automatically">
          <textarea value={raw} onChange={e => setRaw(e.target.value)}
            placeholder={"Paste invoice content here...\n\nLot 2 | Siemens 6FC5303 | Bid $100 | Premium $18\nLot 41 | Siemens TP1200 HMI | Bid $275 | Premium $49.50\n..."}
            style={{ width: "100%", height: 200, padding: 10, border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12, fontFamily: "monospace", resize: "vertical", boxSizing: "border-box", outline: "none" }} />
        </FG>
        {err && <div style={{ color: "#dc2626", fontSize: 12, marginBottom: 8 }}>Error: {err}</div>}
        <div style={{ display: "flex", gap: 10 }}>
          <TBtn click={parseAI} color="dark" disabled={loading}>{loading ? "Reading invoice..." : "Read with AI"}</TBtn>
          <TBtn click={onClose} color="gray">Cancel</TBtn>
        </div>
      </>
    )}

    {step === 2 && (
      <>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{parsed.filter(x => x.selected).length} of {parsed.length} items selected</div>
        <div style={{ maxHeight: 380, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 8, marginBottom: 14 }}>
          {parsed.map((it, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 12px", borderBottom: "0.5px solid #f3f4f6", background: it.selected ? "#fff" : "#fafafa", opacity: it.selected ? 1 : 0.5 }}>
              <input type="checkbox" checked={it.selected} onChange={() => tog(i)} style={{ flexShrink: 0, width: 16, height: 16, cursor: "pointer" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</div>
                <div style={{ display: "flex", gap: 10, marginTop: 3, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, color: "#888" }}>Lot: {it.lotNumber || "—"}</span>
                  <span style={{ fontSize: 11, color: "#888" }}>Qty: {it.qty || 1}</span>
                  <span style={{ fontSize: 11, color: "#dc2626" }}>Bid: ${it.bidPrice || 0}</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <input type="number" value={it.listP || ""} onChange={e => upd(i, "listP", e.target.value)} placeholder="List $" style={{ width: 72, padding: "4px 6px", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 12, outline: "none" }} />
                <select value={it.cat || "Industrial Automation"} onChange={e => upd(i, "cat", e.target.value)} style={{ fontSize: 11, padding: "4px 6px", border: "1px solid #e5e7eb", borderRadius: 6, maxWidth: 140, outline: "none" }}>
                  {CATS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <TBtn click={() => setStep(3)} color="dark">Set Locations</TBtn>
          <TBtn click={() => setStep(1)} color="gray">Back</TBtn>
        </div>
      </>
    )}

    {step === 3 && (
      <>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Set Locations — numbers only</div>
        <div style={{ maxHeight: 360, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 8, marginBottom: 14 }}>
          {parsed.filter(x => x.selected).map((it, i) => {
            const ri = parsed.indexOf(it);
            return (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 12px", borderBottom: "0.5px solid #f3f4f6" }}>
                <div style={{ flex: 1, fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {it.name.split(" ").slice(0, 5).join(" ")}
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 10, color: "#888", marginBottom: 1 }}>Rack</div>
                    <select value={String(it.rack || 1)} onChange={e => upd(ri, "rack", parseInt(e.target.value))} style={{ padding: "4px 6px", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 12, width: 55, outline: "none" }}>
                      {Array.from({ length: 7 }, (_, j) => <option key={j + 1} value={j + 1}>R{j + 1}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: "#888", marginBottom: 1 }}>Shelf</div>
                    <select value={String(it.shelf || 1)} onChange={e => upd(ri, "shelf", parseInt(e.target.value))} style={{ padding: "4px 6px", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 12, width: 75, outline: "none" }}>
                      {Object.entries(SHELF_NAMES).map(([k, v]) => <option key={k} value={k}>{k} {v.includes("Floor") ? "Floor" : ""}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: "#888", marginBottom: 1 }}>Pos</div>
                    <input type="number" value={it.pos || 1} onChange={e => upd(ri, "pos", parseInt(e.target.value))} style={{ width: 46, padding: "4px 6px", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 12, outline: "none" }} />
                  </div>
                  <div style={{ fontFamily: "monospace", fontWeight: 800, fontSize: 13, color: "#1a1a2e", marginTop: 14 }}>
                    {it.rack || 1}-{it.shelf || 1}-{it.pos || 1}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <TBtn click={doImport} color="green">Import {parsed.filter(x => x.selected).length} Items</TBtn>
          <TBtn click={() => setStep(2)} color="gray">Back</TBtn>
        </div>
      </>
    )}
  </div>
</div>
```

);
}

// ── Detail Drawer ─────────────────────────────────────────
function Drawer({ item, onClose, onEdit, onSell, onDup }) {
const c = calcPL(item);
return (
<div style={{ position: “fixed”, inset: 0, background: “rgba(0,0,0,0.4)”, zIndex: 800, display: “flex”, justifyContent: “flex-end” }}
onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
<div style={{ background: “#fff”, width: “100%”, maxWidth: 400, height: “100%”, overflowY: “auto”, padding: 24, boxShadow: “-4px 0 24px rgba(0,0,0,0.12)” }}>
<div style={{ display: “flex”, justifyContent: “space-between”, alignItems: “flex-start”, marginBottom: 12 }}>
<div>
<div style={{ fontFamily: “monospace”, fontSize: 22, fontWeight: 900, color: “#1a1a2e” }}>{item.id}</div>
<STag status={item.status} />
</div>
<button onClick={onClose} style={{ background: “transparent”, border: “none”, fontSize: 22, cursor: “pointer”, color: “#bbb” }}>x</button>
</div>
<div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, lineHeight: 1.3 }}>{item.name}</div>
<div style={{ display: “grid”, gridTemplateColumns: “1fr 1fr 1fr”, gap: 8, marginBottom: 14 }}>
{[[“Stock”, item.qtyInStock, “#1d4ed8”, “#dbeafe”], [“Sold”, item.qtySold, “#16a34a”, “#dcfce7”], [“Total”, item.qty, “#374151”, “#f3f4f6”]].map(([l, n, co, bg]) => (
<div key={l} style={{ textAlign: “center”, background: bg, borderRadius: 8, padding: “8px 4px” }}>
<div style={{ fontSize: 10, color: “#6b7280” }}>{l}</div>
<div style={{ fontSize: 24, fontWeight: 900, color: co }}>{n}</div>
</div>
))}
</div>
<div style={{ background: “#1a1a2e”, borderRadius: 10, padding: “12px 16px”, marginBottom: 14, display: “flex”, gap: 14, alignItems: “center” }}>
<div style={{ fontSize: 28 }}>📍</div>
<div>
<div style={{ fontSize: 10, color: “#9ca3af”, textTransform: “uppercase”, letterSpacing: “0.07em” }}>Location</div>
<div style={{ fontSize: 28, fontWeight: 900, color: “#f59e0b”, fontFamily: “monospace” }}>{loc(item)}</div>
<div style={{ fontSize: 11, color: “#9ca3af” }}>{locFull(item)}</div>
</div>
</div>
{[[“SKU”, item.sku], [“Supplier”, item.supplier], [“Invoice”, item.invoice], [“Lots”, item.lots], [“Purchased”, item.bought], [“Received”, item.received]].map(([l, v]) =>
v ? <FRow key={l} label={l} val={v} /> : null
)}
{item.notes && (
<div style={{ background: “#f8fafc”, borderRadius: 6, padding: “8px 10px”, fontSize: 12, color: “#555”, marginTop: 8, lineHeight: 1.5 }}>{item.notes}</div>
)}
<div style={{ marginTop: 14 }}><PLBox item={item} /></div>
{(item.sales || []).length > 0 && (
<div style={{ marginTop: 14 }}>
<div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8 }}>Sales History</div>
{item.sales.map((s, i) => {
const r = (parseFloat(s.price) || 0) + (parseFloat(s.shipCharged) || 0);
const pf = r * (PLATFORMS[s.channel || item.channel]?.fee || 0);
const g = r - pf - (parseFloat(s.shipCost) || 0) - (parseFloat(s.packCost) || 0) - item.costUnit;
const n = g - (g > 0 ? g * TAX : 0);
return (
<div key={i} style={{ display: “flex”, justifyContent: “space-between”, fontSize: 12, padding: “6px 10px”, background: i % 2 ? “#fafafa” : “#fff”, borderRadius: 6, marginBottom: 3 }}>
<span style={{ color: “#888” }}>{s.date} · {money(s.price)}</span>
<span style={{ fontWeight: 700, color: n >= 0 ? “#16a34a” : “#dc2626” }}>{money(n)} net</span>
</div>
);
})}
</div>
)}
<div style={{ display: “flex”, gap: 8, marginTop: 20, flexWrap: “wrap” }}>
{item.qtyInStock > 0 && <TBtn click={onSell} color="green">Record Sale</TBtn>}
<TBtn click={onEdit} color="white">Edit</TBtn>
<TBtn click={onDup} color="purple">Duplicate</TBtn>
</div>
</div>
</div>
);
}

// ── Warehouse Map ─────────────────────────────────────────
function WMap({ items, onSelect }) {
return (
<div>
<div style={{ background: “#eff6ff”, border: “1px solid #bfdbfe”, borderRadius: 8, padding: “10px 14px”, marginBottom: 16, fontSize: 13, color: “#1e40af” }}>
Location format: Rack-Shelf-Position (all numbers) · Shelf 1=top · Shelf 5=Floor · Rack 1 active now
</div>
<div style={{ display: “grid”, gridTemplateColumns: “repeat(auto-fill, minmax(260px, 1fr))”, gap: 14 }}>
{Array.from({ length: RACKS }, (_, ri) => ri + 1).map(rack => {
const rItems = items.filter(i => Number(i.rack) === rack);
const active = rItems.length > 0;
return (
<div key={rack} style={{ background: active ? “#fff” : “#fafafa”, border: “1px solid “ + (active ? “#e5e7eb” : “#f3f4f6”), borderRadius: 10, overflow: “hidden”, opacity: active ? 1 : 0.55 }}>
<div style={{ background: active ? “#1a1a2e” : “#9ca3af”, color: “#fff”, padding: “8px 14px”, display: “flex”, justifyContent: “space-between” }}>
<span style={{ fontWeight: 700, fontSize: 14 }}>RACK {rack}</span>
<span style={{ fontSize: 11, color: “#9ca3af” }}>{active ? rItems.length + “ products” : “Future rack”}</span>
</div>
{[1, 2, 3, 4, 5].map(shelf => {
const shItems = items.filter(i => Number(i.rack) === rack && Number(i.shelf) === shelf);
const isFloor = shelf === 5;
return (
<div key={shelf} style={{ display: “flex”, gap: 4, padding: “4px 8px”, borderBottom: “0.5px solid #f3f4f6”, alignItems: “stretch”, background: isFloor ? “#faf5eb” : “transparent” }}>
<div style={{ width: 30, display: “flex”, alignItems: “center”, justifyContent: “center”, fontSize: 11, fontWeight: 800, color: isFloor ? “#92400e” : “#9ca3af”, background: isFloor ? “#fef3c7” : “#f8fafc”, borderRadius: 4, flexShrink: 0, border: “1px solid “ + (isFloor ? “#fcd34d” : “#f3f4f6”) }}>
{isFloor ? “F” : shelf}
</div>
<div style={{ flex: 1, display: “flex”, gap: 4, flexWrap: “wrap” }}>
{shItems.length > 0 ? shItems.map(item => (
<div key={item.id} onClick={() => onSelect(item.id)}
style={{ minWidth: 80, flex: 1, borderRadius: 6, padding: “4px 6px”, cursor: “pointer”, border: “1px solid”, background: item.qtyInStock === 0 ? “#f0fdf4” : item.status === “listed” ? “#fef3c7” : “#eff6ff”, borderColor: item.qtyInStock === 0 ? “#86efac” : item.status === “listed” ? “#fcd34d” : “#bfdbfe” }}>
<div style={{ fontSize: 9, fontWeight: 900, color: “#1a1a2e” }}>{item.id}</div>
<div style={{ fontSize: 10, color: “#374151”, lineHeight: 1.2, overflow: “hidden”, textOverflow: “ellipsis”, whiteSpace: “nowrap”, maxWidth: 120 }}>{item.name.split(” “).slice(0, 3).join(” “)}</div>
<div style={{ display: “flex”, justifyContent: “space-between”, marginTop: 2 }}>
<span style={{ fontSize: 9, color: item.qtyInStock <= 2 ? “#dc2626” : “#6b7280”, fontWeight: 700 }}>x{item.qtyInStock}</span>
<span style={{ fontSize: 9, color: item.qtySold > 0 ? “#16a34a” : “#9ca3af”, fontWeight: 700 }}>{item.qtySold}sold</span>
</div>
</div>
)) : (
<div style={{ flex: 1, background: “#fafafa”, borderRadius: 6, display: “flex”, alignItems: “center”, justifyContent: “center”, minHeight: 44, border: “1px dashed #e5e7eb” }}>
<span style={{ fontSize: 10, color: “#d1d5db” }}>{rack}-{shelf} free</span>
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

// ── Main App ──────────────────────────────────────────────
export default function App() {
const [items, setItems]         = useState([]);
const [tab, setTab]             = useState(“dashboard”);
const [detailId, setDetailId]   = useState(null);
const [sellId, setSellId]       = useState(null);
const [editItem, setEditItem]   = useState(null);
const [showInv, setShowInv]     = useState(false);
const [search, setSearch]       = useState(””);
const [stFlt, setStFlt]         = useState(“all”);
const [toast, setToast]         = useState(null);
const [loaded, setLoaded]       = useState(false);
const [syncMsg, setSyncMsg]     = useState(“Connecting…”);

useEffect(() => {
(async () => {
try {
const cloud = await cloudLoad();
if (cloud && cloud.length > 0) {
setItems(cloud);
setSyncMsg(“Cloud sync OK”);
} else {
setSyncMsg(“Loading local data…”);
try {
const r = await window.storage.get(“mp_erp_v6”);
const local = r?.value ? JSON.parse(r.value) : null;
const data = (local && local.length > 0) ? local : buildSeed();
setItems(data);
cloudSave(data);
setSyncMsg(“Uploaded to cloud”);
} catch {
const seed = buildSeed();
setItems(seed);
cloudSave(seed);
setSyncMsg(“Ready”);
}
}
} catch {
setItems(buildSeed());
setSyncMsg(“Offline mode”);
}
setLoaded(true);
setTimeout(() => setSyncMsg(””), 5000);
})();
}, []);

async function persist(data) {
setItems(data);
cloudSave(data);
try { await window.storage.set(“mp_erp_v6”, JSON.stringify(data)); } catch {}
}

function toast$(msg, ok) {
setToast({ msg, ok: ok !== false });
setTimeout(() => setToast(null), 3500);
}

function saveItem(upd) {
const exists = items.find(i => i.id === upd.id);
persist(exists ? items.map(i => i.id === upd.id ? upd : i) : […items, upd]);
setEditItem(null); setDetailId(null);
toast$(“Saved: “ + upd.id);
}
function saveSale(upd) {
persist(items.map(i => i.id === upd.id ? upd : i));
setSellId(null);
toast$(“Sale recorded — “ + upd.qtyInStock + “ units remain”);
}
function importItems(newItems) {
persist([…items, …newItems]);
toast$(newItems.length + “ items imported!”);
}
function startNew() {
setEditItem({
id: genId(items), name: “”, sku: “”, cat: “Industrial Automation”, cond: “uw”,
qty: 1, qtyInStock: 1, qtySold: 0, supplier: “”, invoice: “”, lots: “”,
bought: today(), received: “”, listed: “”,
rack: 1, shelf: 1, pos: 1, notes: “”,
channel: “ebay”, listP: “”, listUrl: “”,
costTotal: “”, costUnit: “”, status: “purchased”, sales: [],
});
setDetailId(null);
}
function dupItem(item) {
setEditItem({ …item, id: genId(items), sales: [], qtySold: 0, status: “received”, listed: “”, _dup: true });
setDetailId(null);
toast$(“Duplicating “ + item.id);
}
function exportData() {
const blob = new Blob([JSON.stringify(items, null, 2)], { type: “application/json” });
const url = URL.createObjectURL(blob);
const a = document.createElement(“a”);
a.href = url; a.download = “mp-erp-” + today() + “.json”; a.click();
URL.revokeObjectURL(url);
toast$(“Backup downloaded”);
}
function importFile(e) {
const file = e.target.files[0]; if (!file) return;
const reader = new FileReader();
reader.onload = ev => {
try {
const data = JSON.parse(ev.target.result);
if (!Array.isArray(data)) throw new Error();
persist(data);
toast$(data.length + “ items loaded!”);
} catch { toast$(“Invalid file”, false); }
};
reader.readAsText(file);
e.target.value = “”;
}

const detailItem = detailId ? items.find(i => i.id === detailId) : null;
const sellItem   = sellId   ? items.find(i => i.id === sellId)   : null;
const totalNet   = items.reduce((a, i) => a + calcPL(i).net, 0);
const stockVal   = items.reduce((a, i) => a + calcPL(i).cu * (i.qtyInStock || 0), 0);
const totalSold  = items.reduce((a, i) => a + (i.qtySold || 0), 0);
const totalStock = items.reduce((a, i) => a + (i.qtyInStock || 0), 0);
const filtered   = items.filter(i => {
if (stFlt !== “all” && i.status !== stFlt) return false;
if (search) {
const q = search.toLowerCase();
return i.name.toLowerCase().includes(q) || i.id.toLowerCase().includes(q) || (i.sku || “”).toLowerCase().includes(q) || (i.invoice || “”).toLowerCase().includes(q);
}
return true;
});

const TABS = [
{ id: “dashboard”, icon: “📊”, label: “Dashboard” },
{ id: “inventory”, icon: “📦”, label: “Inventory” },
{ id: “map”,       icon: “🗺”,  label: “Warehouse” },
{ id: “analytics”, icon: “📈”, label: “Analytics” },
];

if (!loaded) {
return (
<div style={{ display: “flex”, alignItems: “center”, justifyContent: “center”, height: “100vh”, flexDirection: “column”, gap: 12, color: “#888” }}>
<div style={{ fontSize: 32 }}>☁</div>
<div style={{ fontSize: 16, fontWeight: 600 }}>Connecting to cloud…</div>
</div>
);
}

return (
<div style={{ fontFamily: “system-ui, -apple-system, sans-serif”, minHeight: “100vh”, background: “#f4f5f7”, color: “#111” }}>

```
  {toast && (
    <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999, background: toast.ok ? "#1a1a2e" : "#dc2626", color: "#fff", padding: "10px 20px", borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: "0 4px 24px rgba(0,0,0,0.3)", maxWidth: 340 }}>
      {toast.msg}
    </div>
  )}
  {syncMsg && (
    <div style={{ position: "fixed", bottom: 16, right: 16, zIndex: 9998, background: "#2563eb", color: "#fff", padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
      ☁ {syncMsg}
    </div>
  )}

  {sellItem  && <SellModal    item={sellItem}  onClose={() => setSellId(null)}  onSave={saveSale} />}
  {editItem  && <EditModal    item={editItem}  onClose={() => setEditItem(null)} onSave={saveItem} />}
  {showInv   && <InvoiceModal existingItems={items} onClose={() => setShowInv(false)} onImport={importItems} />}
  {detailItem && !sellId && !editItem && !showInv && (
    <Drawer item={detailItem} onClose={() => setDetailId(null)}
      onEdit={() => { setEditItem(detailItem); setDetailId(null); }}
      onSell={() => { setSellId(detailItem.id); setDetailId(null); }}
      onDup={() => dupItem(detailItem)} />
  )}

  {/* Header */}
  <div style={{ background: "#1a1a2e", color: "#fff", padding: "0 20px" }}>
    <div style={{ maxWidth: 980, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0 10px", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: "0.18em", color: "#6b7280", textTransform: "uppercase" }}>MP Business Strategy LLC · S-Corp · FL/SC</div>
          <div style={{ fontSize: 20, fontWeight: 900 }}>Inventory + Warehouse ERP</div>
          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{items.length} products · {totalStock} in stock · {totalSold} sold · Cloud sync active</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={startNew} style={{ padding: "8px 14px", background: "#f59e0b", border: "none", borderRadius: 8, color: "#000", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>+ Add</button>
          <button onClick={() => setShowInv(true)} style={{ padding: "8px 14px", background: "#7c3aed", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Invoice</button>
          <button onClick={exportData} style={{ padding: "8px 14px", background: "#2563eb", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Export</button>
          <label style={{ padding: "8px 14px", background: "#16a34a", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", display: "inline-block" }}>
            Import<input type="file" accept=".json" onChange={importFile} style={{ display: "none" }} />
          </label>
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

    {/* Dashboard */}
    {tab === "dashboard" && (
      <div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 20 }}>
          {[
            { l: "Net Profit (28.5%)", v: money(totalNet),   s: totalSold + " units sold", c: "#16a34a", bg: "#f0fdf4" },
            { l: "Capital in Stock",   v: money(stockVal),   s: totalStock + " units",     c: "#d97706", bg: "#fffbeb" },
            { l: "Products",           v: items.length,      s: "invoice #1410243",         c: "#2563eb", bg: "#eff6ff" },
            { l: "Tax Reserve (28.5%)",v: money(items.reduce((a, i) => a + calcPL(i).taxAmt, 0)), s: "S-Corp FL/SC", c: "#dc2626", bg: "#fef2f2" },
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
            <span>All Products</span>
            <button onClick={() => setTab("inventory")} style={{ padding: "5px 12px", background: "#f3f4f6", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>View All</button>
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
                {items.map((it, idx) => {
                  const c = calcPL(it);
                  return (
                    <tr key={it.id} onClick={() => setDetailId(it.id)}
                      style={{ borderBottom: "0.5px solid #f3f4f6", cursor: "pointer", background: idx % 2 === 0 ? "#fff" : "#fafafa" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#eff6ff"}
                      onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? "#fff" : "#fafafa"}>
                      <td style={{ padding: "9px 12px", fontFamily: "monospace", fontWeight: 700, color: "#1a1a2e" }}>{it.id}</td>
                      <td style={{ padding: "9px 12px", fontWeight: 600, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</td>
                      <td style={{ padding: "9px 12px" }}><span style={{ fontFamily: "monospace", fontSize: 12, background: "#f3f4f6", padding: "2px 8px", borderRadius: 20, fontWeight: 700 }}>{loc(it)}</span></td>
                      <td style={{ padding: "9px 12px", textAlign: "center" }}>
                        <span style={{ background: it.qtyInStock === 0 ? "#dcfce7" : it.qtyInStock <= 2 ? "#fef3c7" : "#dbeafe", color: it.qtyInStock === 0 ? "#166534" : it.qtyInStock <= 2 ? "#92400e" : "#1d4ed8", padding: "2px 10px", borderRadius: 20, fontWeight: 700 }}>{it.qtyInStock}</span>
                      </td>
                      <td style={{ padding: "9px 12px", textAlign: "center" }}>
                        <span style={{ background: it.qtySold > 0 ? "#dcfce7" : "#f3f4f6", color: it.qtySold > 0 ? "#166534" : "#9ca3af", padding: "2px 10px", borderRadius: 20, fontWeight: 700 }}>{it.qtySold}</span>
                      </td>
                      <td style={{ padding: "9px 12px", fontWeight: 700, color: c.eN >= 0 ? "#16a34a" : "#dc2626" }}>{money(c.eN)}</td>
                      <td style={{ padding: "9px 12px" }}><STag status={it.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )}

    {/* Inventory */}
    {tab === "inventory" && (
      <div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, ID, SKU, invoice..."
            style={{ flex: 1, minWidth: 200, padding: "10px 14px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none", fontFamily: "inherit", background: "#fff" }} />
          <TSelect val={stFlt} set={setStFlt} options={[["all", "All Status"], ...Object.entries(ST).map(([k, v]) => [k, v.icon + " " + v.l])]} />
          <TBtn click={startNew} color="dark">+ Add Item</TBtn>
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
                  <STag status={item.status} />
                </div>
                <div style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.3, marginBottom: 8 }}>{item.name}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                  <span style={{ fontSize: 10, background: "#f3f4f6", color: "#374151", padding: "2px 8px", borderRadius: 20, fontFamily: "monospace", fontWeight: 700 }}>📍 {loc(item)}</span>
                  {days != null && <span style={{ fontSize: 10, color: days > 60 ? "#dc2626" : days > 30 ? "#d97706" : "#16a34a" }}>{days}d in stock</span>}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 10 }}>
                  {[
                    { l: "Stock", v: item.qtyInStock, c: "#2563eb", bg: "#dbeafe" },
                    { l: "Sold",  v: item.qtySold,    c: "#16a34a", bg: "#dcfce7" },
                    { l: "Est.Net", v: money(c.eN), c: c.eN >= 0 ? "#16a34a" : "#dc2626", bg: "#f8fafc" },
                  ].map((x, i) => (
                    <div key={i} style={{ background: x.bg, borderRadius: 6, padding: "5px 8px", textAlign: "center" }}>
                      <div style={{ fontSize: 9, color: "#6b7280", textTransform: "uppercase" }}>{x.l}</div>
                      <div style={{ fontWeight: 800, fontSize: 13, color: x.c }}>{x.v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
                  {item.qtyInStock > 0 && <TBtn click={() => setSellId(item.id)} color="green" sm full>Record Sale</TBtn>}
                  <TBtn click={() => dupItem(item)} color="purple" sm>Dup</TBtn>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    )}

    {/* Warehouse Map */}
    {tab === "map" && <WMap items={items} onSelect={id => setDetailId(id)} />}

    {/* Analytics */}
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
            <div style={{ background: "#f8fafc", borderBottom: "1px solid #e5e7eb", padding: "12px 16px", fontWeight: 700, fontSize: 14 }}>Best Margin / Unit</div>
            <div style={{ padding: "0 16px" }}>
              {[...items].sort((a, b) => calcPL(b).eN - calcPL(a).eN).slice(0, 8).map((it, i) => {
                const c = calcPL(it);
                return (
                  <div key={it.id} onClick={() => setDetailId(it.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "0.5px solid #f3f4f6", cursor: "pointer" }}>
                    <div>
                      <span style={{ fontWeight: 900, color: "#f59e0b", marginRight: 6 }}>#{i + 1}</span>
                      <span style={{ fontWeight: 600 }}>{it.id}</span>
                      <div style={{ fontSize: 11, color: "#888" }}>{it.name.split(" ").slice(0, 4).join(" ")} · x{it.qtyInStock}</div>
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
            <div style={{ background: "#f8fafc", borderBottom: "1px solid #e5e7eb", padding: "12px 16px", fontWeight: 700, fontSize: 14 }}>Longest in Stock</div>
            <div style={{ padding: "0 16px" }}>
              {[...items.filter(i => i.received && i.qtyInStock > 0)]
                .map(i => ({ ...i, days: Math.ceil((new Date() - new Date(i.received)) / 86400000) }))
                .sort((a, b) => b.days - a.days)
                .slice(0, 8)
                .map(it => (
                  <div key={it.id} onClick={() => setDetailId(it.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "0.5px solid #f3f4f6", cursor: "pointer" }}>
                    <div>
                      <span style={{ fontWeight: 600 }}>{it.id}</span>
                      <div style={{ fontSize: 11, color: "#888" }}>{it.name.split(" ").slice(0, 4).join(" ")}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 800, color: it.days > 60 ? "#dc2626" : it.days > 30 ? "#d97706" : "#16a34a" }}>{it.days}d</div>
                      <div style={{ fontSize: 11, color: "#888" }}>x{it.qtyInStock} left</div>
                    </div>
                  </div>
                ))}
              <div style={{ background: "#fffbeb", borderRadius: 8, padding: "8px 12px", margin: "10px 0", fontSize: 12, color: "#78350f" }}>
                Items over 60 days: consider reducing price 10-15% to sell faster.
              </div>
            </div>
          </div>
        </div>
      </div>
    )}
  </div>
</div>
```

);
}
