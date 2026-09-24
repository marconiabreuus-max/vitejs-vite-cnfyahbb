// @ts-nocheck
/* eslint-disable */
import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const SB_URL = "https://fpjapzovpxwdvrsgosxe.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwamFwem92cHh3ZHZyc2dvc3hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MTA0NjQsImV4cCI6MjA5NDI4NjQ2NH0.xiO-OBQbh9gn8ZZbQn4jyAA3JBUyAySqNi2Y4IRhedk";
const supabase = createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
const SYNC_VERSION = "sync-v5-delete-safe";
const TAX = 0.285;
const RACKS = 7;
const SHELF_NAMES = { 1:"Shelf 1 (top)", 2:"Shelf 2", 3:"Shelf 3", 4:"Shelf 4", 5:"Floor" };
const PLATFORMS = { ebay:{label:"eBay",fee:0.1325}, amazon:{label:"Amazon",fee:0.15}, shopify:{label:"Shopify",fee:0.029}, fb:{label:"Facebook",fee:0.05}, direct:{label:"Direct",fee:0} };
const CATS = ["Industrial Automation","Servo Motors","HMI / Panels","Circuit Breakers","Power Supplies","Safety Components","Network Equipment","Electronics","Other"];
const COND = {ns:"New Sealed",no:"New Open Box",rf:"Refurbished",uw:"Used / Working",uu:"Used / Untested"};
const ST = { purchased:{l:"Purchased",c:"#78716c",bg:"#f5f5f4",icon:"🛒"}, received:{l:"In Stock",c:"#2563eb",bg:"#dbeafe",icon:"📦"}, listed:{l:"Listed",c:"#d97706",bg:"#fef3c7",icon:"📢"}, sold:{l:"Sold",c:"#16a34a",bg:"#dcfce7",icon:"✅"}, removed:{l:"Removed",c:"#dc2626",bg:"#fee2e2",icon:"🗑"} };

async function withTimeout(fn, ms=4000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try { return await fn(controller.signal); } finally { clearTimeout(timer); }
}
function dataScore(items) { const active=Array.isArray(items)?items.filter(i=>!i._deleted):[]; return active.length+(active.reduce((a,i)=>a+((i.sales||[]).length||0),0)/1000); }
function cleanItem(item) { const x={...item}; delete x._dup; return x; }
function itemChanged(a,b) { const aa=cleanItem(a),bb=cleanItem(b); delete aa._syncAt; delete bb._syncAt; return JSON.stringify(aa)!==JSON.stringify(bb); }
function deletedLoad() { try{const d=localStorage.getItem("mp_erp_deleted");return d?JSON.parse(d):{};}catch{return{};} }
function deletedSave(d) { try{localStorage.setItem("mp_erp_deleted",JSON.stringify(d||{}));}catch{} }
function deletedTombstones() { const d=deletedLoad(); return Object.entries(d).map(([id,time])=>({id,_deleted:true,_syncAt:time,name:"Deleted item"})); }
function nextId(items) { const ids=[...items.map(i=>i.id),...Object.keys(deletedLoad())]; const nums=ids.map(id=>parseInt((id||"").replace("MP-",""),10)).filter(n=>!isNaN(n)); return"MP-"+String((nums.length?Math.max(...nums):0)+1).padStart(3,"0"); }
function mergeInventories(...copies) {
  const deleted=deletedLoad();
  copies.filter(Array.isArray).flat().forEach(raw=>{
    if(raw&&raw._deleted&&raw.id){
      const time=raw._syncAt||new Date().toISOString();
      if(!deleted[raw.id]||time>deleted[raw.id])deleted[raw.id]=time;
    }
  });
  deletedSave(deleted);
  const out=[];
  copies.filter(Array.isArray).flat().forEach(raw=>{
    if(raw&&raw._deleted)return;
    const item=cleanItem(raw);
    const deletedAt=deleted[item.id];
    if(deletedAt&&deletedAt>=(item._syncAt||""))return;
    const ix=out.findIndex(x=>x.id===item.id);
    if(ix<0){out.push(item);return;}
    const old=out[ix];
    if(!itemChanged(old,item))return;
    const oldTime=old._syncAt||"";
    const newTime=item._syncAt||"";
    if(oldTime||newTime){
      if(newTime>=oldTime)out[ix]=item;
      return;
    }
    if((old.name||"")!==(item.name||"")){
      out.push({...item,id:nextId([...out,item])});
    } else {
      out[ix]=item;
    }
  });
  return out.sort((a,b)=>(parseInt((a.id||"").replace("MP-",""),10)||0)-(parseInt((b.id||"").replace("MP-",""),10)||0));
}
async function cloudLoadCopies() {
  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return null;
    const { data, error } = await supabase.from("inventory").select("data").eq("id", "mp_erp_data");
    if (error) return null;
    const copies=(data||[]).map(x=>x.data).filter(x=>Array.isArray(x)&&x.length>0);
    return copies.length?copies:null;
  } catch { return null; }
}
async function cloudLoad() { const copies=await cloudLoadCopies(); return copies?mergeInventories(...copies):null; }
async function supabaseSave(payload) {
  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return false;
    const { error } = await supabase.from("inventory").update({data:payload}).eq("id", "mp_erp_data");
    return !error;
  } catch { return false; }
}
function isRealItem(i) { return i && !i._deleted && String(i.name||"").toLowerCase()!=="deleted item"; }
async function cloudSave(items) { return supabaseSave(items.filter(isRealItem)); }
function sameItems(a,b) { try{return JSON.stringify(a)===JSON.stringify(b);}catch{return false;} }
function localSave() {}
function localLoad() { return null; }
function loc(item) { if(!item.rack||!item.shelf)return"—"; return item.pos?`${item.rack}-${item.shelf}-${item.pos}`:`${item.rack}-${item.shelf}`; }
function locFull(item) { if(!item.rack||!item.shelf)return"No location"; return`Rack ${item.rack} · ${SHELF_NAMES[item.shelf]||"Shelf "+item.shelf}${item.pos?" · Pos "+item.pos:""}`; }
function money(v) { if(v==null||isNaN(v))return"—"; return(v<0?"-$":"$")+Math.abs(v).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}); }
function pct(v) { return(v==null||isNaN(v))?"—":v.toFixed(1)+"%"; }
function today() { return new Date().toISOString().slice(0,10); }
function genId(items) { const nums=items.map(i=>parseInt((i.id||"").replace("MP-",""),10)).filter(n=>!isNaN(n)); return"MP-"+String((nums.length?Math.max(...nums):0)+1).padStart(3,"0"); }
function calcPL(item) {
  const cu=parseFloat(item.costUnit)||0,lp=parseFloat(item.listP)||0;
  const fee=lp*(PLATFORMS[item.channel]?.fee||0),eG=lp-fee-cu,eT=eG>0?eG*TAX:0,eN=eG-eT,eM=cu>0?(eN/cu)*100:0;
  let rev=0,pfee=0,gross=0,taxAmt=0,net=0;
  (item.sales||[]).forEach(s=>{const r=(parseFloat(s.price)||0)+(parseFloat(s.shipCharged)||0);const pf=r*(PLATFORMS[s.channel||item.channel]?.fee||0);const g=r-pf-(parseFloat(s.shipCost)||0)-(parseFloat(s.packCost)||0)-cu;const t=g>0?g*TAX:0;rev+=r;pfee+=pf;gross+=g;taxAmt+=t;net+=(g-t);});
  return{cu,lp,fee,eG,eT,eN,eM,rev,pfee,gross,taxAmt,net,totalCostIn:parseFloat(item.costTotal)||0};
}
function needsCostReview(item) { return !item._deleted&&(item.name||"").toLowerCase()!=="teste"&&(!item.invoice||!item.lots||!(parseFloat(item.costTotal)||0)||!(parseFloat(item.costUnit)||0)); }

function Inp({val,set,type,ph,ro}) { return <input readOnly={ro} type={type||"text"} value={val??""} placeholder={ph||""} onChange={e=>set&&set(e.target.value)} style={{width:"100%",padding:"8px 10px",border:"1px solid #e5e7eb",borderRadius:8,fontSize:13,outline:"none",background:ro?"#f8f8f8":"#fff",color:"#111827",WebkitTextFillColor:"#111827",caretColor:"#111827",boxSizing:"border-box",fontFamily:"inherit"}}/>; }
function Sel({val,set,opts}) { return <select value={val} onChange={e=>set(e.target.value)} style={{width:"100%",padding:"8px 10px",border:"1px solid #e5e7eb",borderRadius:8,fontSize:13,background:"#fff",color:"#111827",WebkitTextFillColor:"#111827",caretColor:"#111827",outline:"none",fontFamily:"inherit"}}>{opts.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>; }
function Btn({click,children,color,sm,full,disabled}) {
  const C={dark:{bg:"#1a1a2e",fg:"#fff"},green:{bg:"#16a34a",fg:"#fff"},amber:{bg:"#f59e0b",fg:"#000"},gray:{bg:"#f3f4f6",fg:"#374151"},white:{bg:"#fff",fg:"#374151",bd:"1px solid #d1d5db"},blue:{bg:"#2563eb",fg:"#fff"},purple:{bg:"#7c3aed",fg:"#fff"}};
  const s=C[color||"dark"]||C.dark;
  return <button onClick={click} disabled={disabled} style={{padding:sm?"5px 12px":"9px 18px",border:s.bd||"none",borderRadius:8,background:disabled?"#e5e7eb":s.bg,color:disabled?"#9ca3af":s.fg,fontSize:sm?11:13,fontWeight:600,cursor:disabled?"not-allowed":"pointer",fontFamily:"inherit",width:full?"100%":"auto",whiteSpace:"nowrap"}}>{children}</button>;
}
function STag({status}) { const s=ST[status]||ST.purchased; return <span style={{fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:20,background:s.bg,color:s.c,whiteSpace:"nowrap"}}>{s.icon} {s.l}</span>; }
function FRow({label,val,bold,color}) { return <div style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"0.5px solid #f3f4f6",fontSize:13,fontWeight:bold?700:400}}><span style={{color:"#6b7280"}}>{label}</span><span style={{color:color||"#111"}}>{val}</span></div>; }
function FG({label,children,note}) { return <div style={{marginBottom:12}}><label style={{display:"block",fontSize:10,fontWeight:700,color:"#6b7280",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:3}}>{label}</label>{children}{note&&<div style={{fontSize:10,color:"#9ca3af",marginTop:2}}>{note}</div>}</div>; }
function PLBox({item}) {
  const c=calcPL(item);
  return <div style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:8,padding:"12px 14px",fontSize:13}}>
    <div style={{fontWeight:700,fontSize:10,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>{(item.sales||[]).length>0?"Actual P&L":"Projected P&L"}</div>
    <FRow label="Cost/Unit" val={money(c.cu)} color="#dc2626"/>
    <FRow label="List Price" val={money(c.lp)}/>
    <FRow label={"Fee ("+PLATFORMS[item.channel]?.label+")"} val={"-"+money(c.fee)}/>
    <FRow label="Est. Net/Unit (28.5%)" val={money(c.eN)} color={c.eN>=0?"#16a34a":"#dc2626"} bold/>
    <FRow label="Est. Margin" val={pct(c.eM)} color={c.eM>=120?"#16a34a":c.eM>=50?"#d97706":"#dc2626"}/>
    {(item.sales||[]).length>0&&<><div style={{borderTop:"1px dashed #e2e8f0",margin:"6px 0"}}/><FRow label={`Revenue (${item.qtySold} sold)`} val={money(c.rev)} color="#16a34a"/><FRow label="Net Profit" val={money(c.net)} bold color={c.net>=0?"#16a34a":"#dc2626"}/></>}
  </div>;
}

function SellModal({item,onClose,onSave}) {
  const [dt,setDt]=useState(today());const [ch,setCh]=useState(item.channel||"ebay");const [pr,setPr]=useState("");const [sc,setSc]=useState("");const [so,setSo]=useState("");const [pk,setPk]=useState("");
  const saleCogs=parseFloat(item.costUnit)||0,rev=(parseFloat(pr)||0)+(parseFloat(sc)||0),pf=rev*(PLATFORMS[ch]?.fee||0),gross=rev-pf-(parseFloat(so)||0)-(parseFloat(pk)||0)-saleCogs,tax=gross>0?gross*TAX:0,net=gross-tax;
  function confirm(){if(!pr){alert("Enter sale price");return;}const sale={date:dt,channel:ch,price:parseFloat(pr),shipCharged:parseFloat(sc)||0,shipCost:parseFloat(so)||0,packCost:parseFloat(pk)||0,costUnitAtSale:saleCogs,cogsAtSale:saleCogs,costNormalizationBatchId:item._costNormalizationBatchId||"sale-snapshot"};const left=Math.max(0,(item.qtyInStock||0)-1);onSave({...item,sales:[...(item.sales||[]),sale],qtySold:(item.qtySold||0)+1,qtyInStock:left,status:left===0?"sold":item.status,listed:item.listed||today()});onClose();}
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:900,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
    <div style={{background:"#fff",borderRadius:14,width:"100%",maxWidth:480,padding:24,maxHeight:"90vh",overflowY:"auto"}}>
      <div style={{fontWeight:800,fontSize:18,marginBottom:4}}>Record Sale</div>
      <div style={{fontSize:13,color:"#888",marginBottom:12}}>{item.id} — {item.name}</div>
      <div style={{background:"#f8fafc",borderRadius:8,padding:"8px 12px",marginBottom:14,fontSize:12,color:"#555"}}>Cost/unit: <strong>{money(item.costUnit)}</strong> · Location: <strong style={{fontFamily:"monospace"}}>{loc(item)}</strong> · After sale: <strong style={{color:item.qtyInStock-1<=0?"#dc2626":"#16a34a"}}>{Math.max(0,item.qtyInStock-1)} remain</strong></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        <FG label="Sale Date"><Inp val={dt} set={setDt} type="date"/></FG>
        <FG label="Platform"><Sel val={ch} set={setCh} opts={Object.entries(PLATFORMS).map(([k,v])=>[k,v.label+" ("+(v.fee*100).toFixed(1)+"%)"]) }/></FG>
        <FG label="Sale Price *"><Inp val={pr} set={setPr} type="number" ph="0.00"/></FG>
        <FG label="Shipping Charged"><Inp val={sc} set={setSc} type="number" ph="0.00"/></FG>
        <FG label="Your Shipping Cost"><Inp val={so} set={setSo} type="number" ph="0.00"/></FG>
        <FG label="Packaging Cost"><Inp val={pk} set={setPk} type="number" ph="0.00"/></FG>
      </div>
      <div style={{background:net>=0?"#f0fdf4":"#fef2f2",border:"1px solid "+(net>=0?"#86efac":"#fca5a5"),borderRadius:8,padding:"10px 14px",marginBottom:14}}>
        <FRow label="Revenue" val={money(rev)} color="#16a34a"/><FRow label="Platform Fee" val={"-"+money(pf)} color="#dc2626"/><FRow label="Cost of Unit" val={"-"+money(saleCogs)} color="#dc2626"/><FRow label="Gross Profit" val={money(gross)} bold/><FRow label="Tax (28.5%)" val={"-"+money(tax)} color="#dc2626"/>
        <div style={{display:"flex",justifyContent:"space-between",padding:"8px",background:net>=0?"#dcfce7":"#fee2e2",borderRadius:6,marginTop:6,fontWeight:800,fontSize:15}}><span>NET PROFIT</span><span style={{color:net>=0?"#16a34a":"#dc2626"}}>{money(net)}</span></div>
      </div>
      <div style={{display:"flex",gap:10}}><Btn click={confirm} color="green" full>Confirm Sale</Btn><Btn click={onClose} color="gray">Cancel</Btn></div>
    </div>
  </div>;
}

function EditModal({item,onClose,onSave}) {
  const [f,setF]=useState({...item});const u=k=>v=>setF(x=>({...x,[k]:v}));const c=calcPL(f);
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:900,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:16,overflowY:"auto"}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
    <div style={{background:"#fff",borderRadius:14,width:"100%",maxWidth:660,padding:24,margin:"auto"}}>
      <div style={{fontWeight:800,fontSize:17,marginBottom:16}}>{item._dup?"Duplicate":"Edit"} — {item.id}</div>
      <FG label="Product Name *"><Inp val={f.name} set={u("name")} ph="Product name"/></FG>
      <div style={{display:"flex",gap:10}}><div style={{flex:1}}><FG label="SKU"><Inp val={f.sku} set={u("sku")}/></FG></div><div style={{flex:1}}><FG label="Category"><Sel val={f.cat} set={u("cat")} opts={CATS.map(c=>[c,c])}/></FG></div></div>
      <div style={{display:"flex",gap:10}}><div style={{flex:1}}><FG label="Condition"><Sel val={f.cond} set={u("cond")} opts={Object.entries(COND).map(([k,v])=>[k,v])}/></FG></div><div style={{flex:1}}><FG label="Status"><Sel val={f.status} set={u("status")} opts={Object.entries(ST).map(([k,v])=>[k,v.icon+" "+v.l])}/></FG></div></div>
      <div style={{display:"flex",gap:10}}><div style={{flex:1}}><FG label="Total Qty"><Inp val={f.qty} set={u("qty")} type="number"/></FG></div><div style={{flex:1}}><FG label="Qty In Stock"><Inp val={f.qtyInStock} set={u("qtyInStock")} type="number"/></FG></div></div>
      <div style={{fontSize:10,fontWeight:700,color:"#6b7280",textTransform:"uppercase",borderBottom:"1px solid #e5e7eb",paddingBottom:6,marginBottom:12,marginTop:8}}>Location</div>
      <div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:7,padding:"8px 12px",marginBottom:10,fontSize:12,color:"#1e40af"}}>Code: <strong style={{fontFamily:"monospace",fontSize:14}}>{f.rack||"?"}-{f.shelf||"?"}-{f.pos||"?"}</strong></div>
      <div style={{display:"flex",gap:10}}>
        <div style={{flex:1}}><FG label="Rack (1-7)"><Sel val={String(f.rack||1)} set={v=>u("rack")(parseInt(v))} opts={Array.from({length:RACKS},(_,i)=>[String(i+1),"Rack "+(i+1)])}/></FG></div>
        <div style={{flex:1}}><FG label="Shelf (5=floor)"><Sel val={String(f.shelf||1)} set={v=>u("shelf")(parseInt(v))} opts={Object.entries(SHELF_NAMES).map(([k,v])=>[k,k+" — "+v])}/></FG></div>
        <div style={{flex:1}}><FG label="Position"><Inp val={f.pos} set={v=>u("pos")(parseInt(v)||1)} type="number" ph="1"/></FG></div>
      </div>
      <div style={{fontSize:10,fontWeight:700,color:"#6b7280",textTransform:"uppercase",borderBottom:"1px solid #e5e7eb",paddingBottom:6,marginBottom:12,marginTop:8}}>Acquisition</div>
      <div style={{display:"flex",gap:10}}><div style={{flex:1}}><FG label="Supplier"><Inp val={f.supplier} set={u("supplier")}/></FG></div><div style={{flex:1}}><FG label="Invoice #"><Inp val={f.invoice} set={u("invoice")}/></FG></div></div>
      <div style={{display:"flex",gap:10}}><div style={{flex:1}}><FG label="Lots"><Inp val={f.lots} set={u("lots")}/></FG></div><div style={{flex:1}}><FG label="Purchase Date"><Inp val={f.bought} set={u("bought")} type="date"/></FG></div><div style={{flex:1}}><FG label="Received"><Inp val={f.received} set={u("received")} type="date"/></FG></div></div>
      <div style={{fontSize:10,fontWeight:700,color:"#6b7280",textTransform:"uppercase",borderBottom:"1px solid #e5e7eb",paddingBottom:6,marginBottom:12,marginTop:8}}>Pricing</div>
      <div style={{display:"flex",gap:10}}><div style={{flex:1}}><FG label="Total Cost"><Inp val={f.costTotal} set={u("costTotal")} type="number"/></FG></div><div style={{flex:1}}><FG label="Cost/Unit"><Inp val={f.costUnit} set={u("costUnit")} type="number"/></FG></div></div>
      <div style={{display:"flex",gap:10}}><div style={{flex:1}}><FG label="List Price"><Inp val={f.listP} set={u("listP")} type="number"/></FG></div><div style={{flex:1}}><FG label="Channel"><Sel val={f.channel} set={u("channel")} opts={Object.entries(PLATFORMS).map(([k,v])=>[k,v.label])}/></FG></div></div>
      <FG label="Listing URL"><Inp val={f.listUrl} set={u("listUrl")} ph="https://www.ebay.com/itm/..."/></FG>
      <div style={{background:c.eN>=0?"#f0fdf4":"#fef2f2",border:"1px solid "+(c.eN>=0?"#86efac":"#fca5a5"),borderRadius:8,padding:"10px 14px",marginBottom:12,fontSize:13}}>Est. Net/Unit: <strong style={{color:c.eN>=0?"#16a34a":"#dc2626"}}>{money(c.eN)}</strong><span style={{color:"#888",marginLeft:12}}>Margin: {pct(c.eM)}</span></div>
      <FG label="Notes"><textarea value={f.notes||""} onChange={e=>u("notes")(e.target.value)} style={{width:"100%",padding:"8px 10px",border:"1px solid #e5e7eb",borderRadius:8,fontSize:13,minHeight:60,fontFamily:"inherit",resize:"vertical",boxSizing:"border-box",outline:"none",background:"#fff",color:"#111827",WebkitTextFillColor:"#111827",caretColor:"#111827"}}/></FG>
      <div style={{display:"flex",gap:10,marginTop:8}}><Btn click={()=>{if(!f.name.trim()){alert("Product name required");return;}onSave(f);}} color="dark">Save</Btn><Btn click={onClose} color="gray">Cancel</Btn></div>
    </div>
  </div>;
}

function Drawer({item,onClose,onEdit,onSell,onDup,onDelete}) {
  const c=calcPL(item);
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:800,display:"flex",justifyContent:"flex-end"}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
    <div style={{background:"#fff",width:"100%",maxWidth:400,height:"100%",overflowY:"auto",padding:24,boxShadow:"-4px 0 24px rgba(0,0,0,0.12)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
        <div><div style={{fontFamily:"monospace",fontSize:22,fontWeight:900,color:"#1a1a2e"}}>{item.id}</div><STag status={item.status}/></div>
        <button onClick={onClose} style={{background:"transparent",border:"none",fontSize:22,cursor:"pointer",color:"#bbb"}}>✕</button>
      </div>
      <div style={{fontWeight:700,fontSize:14,marginBottom:14,lineHeight:1.3}}>{item.name}</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
        {[["Stock",item.qtyInStock,"#1d4ed8","#dbeafe"],["Sold",item.qtySold,"#16a34a","#dcfce7"],["Total",item.qty,"#374151","#f3f4f6"]].map(([l,n,co,bg])=>(
          <div key={l} style={{textAlign:"center",background:bg,borderRadius:8,padding:"8px 4px"}}><div style={{fontSize:10,color:"#6b7280"}}>{l}</div><div style={{fontSize:24,fontWeight:900,color:co}}>{n}</div></div>
        ))}
      </div>
      <div style={{background:"#1a1a2e",borderRadius:10,padding:"12px 16px",marginBottom:14,display:"flex",gap:14,alignItems:"center"}}>
        <div style={{fontSize:28}}>📍</div>
        <div><div style={{fontSize:10,color:"#9ca3af",textTransform:"uppercase",letterSpacing:"0.07em"}}>Location</div><div style={{fontSize:28,fontWeight:900,color:"#f59e0b",fontFamily:"monospace"}}>{loc(item)}</div><div style={{fontSize:11,color:"#9ca3af"}}>{locFull(item)}</div></div>
      </div>
      {[["SKU",item.sku],["Supplier",item.supplier],["Invoice",item.invoice],["Lots",item.lots],["Purchased",item.bought],["Received",item.received]].map(([l,v])=>v?<FRow key={l} label={l} val={v}/>:null)}
      {item.notes&&<div style={{background:"#f8fafc",borderRadius:6,padding:"8px 10px",fontSize:12,color:"#555",marginTop:8,lineHeight:1.5}}>{item.notes}</div>}
      {item.listUrl&&<div style={{marginTop:8}}><a href={item.listUrl} target="_blank" rel="noreferrer" style={{color:"#2563eb",fontSize:12,fontWeight:600,textDecoration:"none"}}>🔗 View on eBay →</a></div>}
      <div style={{marginTop:14}}><PLBox item={item}/></div>
      {(item.sales||[]).length>0&&<div style={{marginTop:14}}><div style={{fontWeight:700,fontSize:12,marginBottom:8}}>Sales History</div>
        {item.sales.map((s,i)=>{const r=(parseFloat(s.price)||0)+(parseFloat(s.shipCharged)||0);const pf=r*(PLATFORMS[s.channel||item.channel]?.fee||0);const saleCogs=parseFloat(s.cogsAtSale)||item.costUnit;const g=r-pf-(parseFloat(s.shipCost)||0)-(parseFloat(s.packCost)||0)-saleCogs;const n=g-(g>0?g*TAX:0);
          return <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"6px 10px",background:i%2?"#fafafa":"#fff",borderRadius:6,marginBottom:3}}><span style={{color:"#888"}}>{s.date} · {money(s.price)}</span><span style={{fontWeight:700,color:n>=0?"#16a34a":"#dc2626"}}>{money(n)} net</span></div>;
        })}
      </div>}
      <div style={{display:"flex",gap:8,marginTop:20,flexWrap:"wrap"}}>
        {item.qtyInStock>0&&<Btn click={onSell} color="green">Record Sale</Btn>}
        <Btn click={onEdit} color="white">Edit</Btn>
        <Btn click={onDup} color="purple">Duplicate</Btn>
        <Btn click={onDelete} color="gray">Delete</Btn>
      </div>
    </div>
  </div>;
}

function WMap({items,onSelect}) {
  return <div>
    <div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:13,color:"#1e40af"}}>Location: Rack-Shelf-Position · Shelf 5=Floor · Rack 1 active now · Click any cell for details</div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(260px, 1fr))",gap:14}}>
      {Array.from({length:RACKS},(_,ri)=>ri+1).map(rack=>{
        const rItems=items.filter(i=>Number(i.rack)===rack),active=rItems.length>0;
        return <div key={rack} style={{background:active?"#fff":"#fafafa",border:"1px solid "+(active?"#e5e7eb":"#f3f4f6"),borderRadius:10,overflow:"hidden",opacity:active?1:0.55}}>
          <div style={{background:active?"#1a1a2e":"#9ca3af",color:"#fff",padding:"8px 14px",display:"flex",justifyContent:"space-between"}}>
            <span style={{fontWeight:700,fontSize:14}}>RACK {rack}</span>
            <span style={{fontSize:11,color:"#9ca3af"}}>{active?rItems.length+" products":"Future rack"}</span>
          </div>
          {[1,2,3,4,5].map(shelf=>{
            const shItems=items.filter(i=>Number(i.rack)===rack&&Number(i.shelf)===shelf),isFloor=shelf===5;
            return <div key={shelf} style={{display:"flex",gap:4,padding:"4px 8px",borderBottom:"0.5px solid #f3f4f6",alignItems:"stretch",background:isFloor?"#faf5eb":"transparent"}}>
              <div style={{width:30,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:isFloor?"#92400e":"#9ca3af",background:isFloor?"#fef3c7":"#f8fafc",borderRadius:4,flexShrink:0,border:"1px solid "+(isFloor?"#fcd34d":"#f3f4f6")}}>{isFloor?"F":shelf}</div>
              <div style={{flex:1,display:"flex",gap:4,flexWrap:"wrap"}}>
                {shItems.length>0?shItems.map(item=>(
                  <div key={item.id} onClick={()=>onSelect(item.id)} style={{minWidth:80,flex:1,borderRadius:6,padding:"4px 6px",cursor:"pointer",border:"1px solid",background:item.qtyInStock===0?"#f0fdf4":item.status==="listed"?"#fef3c7":"#eff6ff",borderColor:item.qtyInStock===0?"#86efac":item.status==="listed"?"#fcd34d":"#bfdbfe"}}>
                    <div style={{fontSize:9,fontWeight:900,color:"#1a1a2e"}}>{item.id}</div>
                    <div style={{fontSize:10,color:"#374151",lineHeight:1.2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:120}}>{item.name.split(" ").slice(0,3).join(" ")}</div>
                    <div style={{display:"flex",justifyContent:"space-between",marginTop:2}}><span style={{fontSize:9,color:item.qtyInStock<=2?"#dc2626":"#6b7280",fontWeight:700}}>x{item.qtyInStock}</span><span style={{fontSize:9,color:item.qtySold>0?"#16a34a":"#9ca3af",fontWeight:700}}>{item.qtySold}✅</span></div>
                  </div>
                )):(
                  <div style={{flex:1,background:"#fafafa",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",minHeight:44,border:"1px dashed #e5e7eb"}}><span style={{fontSize:10,color:"#d1d5db"}}>{rack}-{shelf} free</span></div>
                )}
              </div>
            </div>;
          })}
        </div>;
      })}
    </div>
  </div>;
}

function CostReview({items,reviewData,onApply,onOpen}) {
  const [filter,setFilter]=useState("all");
  const [selected,setSelected]=useState({});
  const [costs,setCosts]=useState({});
  const dataById=Object.fromEntries((reviewData||[]).map(r=>[r.id,r]));
  const pending=items.filter(needsCostReview).map(item=>({item,review:dataById[item.id]||{id:item.id,confidence:"sem candidato",reason:"sem candidato",question:"Confirme o lote deste produto.",candidates:[]}}));
  const visible=pending.filter(x=>filter==="all"||x.review.confidence===filter);
  const applyChoice=(item,review)=>{
    const c=selected[item.id];
    if(!c){alert("Escolha um lote candidato primeiro.");return;}
    const assigned=parseFloat(costs[item.id]??c.total);
    if(!assigned||assigned<=0){alert("Informe o custo deste produto dentro do lote.");return;}
    onApply(item,c,assigned,review);
  };
  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap",marginBottom:14}}>
      <div>
        <div style={{fontSize:18,fontWeight:900}}>Cost + Lot Review</div>
        <div style={{fontSize:12,color:"#6b7280",marginTop:3}}>Produtos já lançados no ERP, mas sem vínculo seguro com nota, lote ou custo.</div>
      </div>
      <Sel val={filter} set={setFilter} opts={[["all","All"],["alta","High confidence"],["media","Medium"],["baixa","Low"],["sem candidato","No candidate"]]}/>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10,marginBottom:16}}>
      {[{l:"Pending",v:pending.length,c:"#d97706",bg:"#fffbeb"},{l:"High",v:pending.filter(x=>x.review.confidence==="alta").length,c:"#16a34a",bg:"#f0fdf4"},{l:"Medium",v:pending.filter(x=>x.review.confidence==="media").length,c:"#2563eb",bg:"#eff6ff"},{l:"Low / None",v:pending.filter(x=>x.review.confidence==="baixa"||x.review.confidence==="sem candidato").length,c:"#dc2626",bg:"#fef2f2"}].map(k=>
        <div key={k.l} style={{background:k.bg,border:"1px solid "+k.c+"22",borderRadius:10,padding:"12px 14px"}}>
          <div style={{fontSize:10,color:"#6b7280",textTransform:"uppercase",letterSpacing:"0.06em"}}>{k.l}</div>
          <div style={{fontSize:22,fontWeight:900,color:k.c}}>{k.v}</div>
        </div>
      )}
    </div>
    <div style={{display:"grid",gap:12}}>
      {visible.map(({item,review})=>{
        const chosen=selected[item.id];
        const assigned=costs[item.id]??(chosen?chosen.total:"");
        return <div key={item.id} style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,padding:14}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start",flexWrap:"wrap"}}>
            <div style={{minWidth:220,flex:1}}>
              <div style={{fontFamily:"monospace",fontWeight:900,color:"#1a1a2e",fontSize:13}}>{item.id}</div>
              <div style={{fontWeight:800,fontSize:14,lineHeight:1.25,marginTop:2}}>{item.name}</div>
              <div style={{fontSize:11,color:"#6b7280",marginTop:5}}>Reason: {review.reason} · Confidence: {review.confidence}</div>
              <div style={{fontSize:11,color:"#6b7280",marginTop:2}}>Current: invoice {item.invoice||"—"} · lots {item.lots||"—"} · cost {money(parseFloat(item.costTotal)||0)}</div>
            </div>
            <Btn click={()=>onOpen(item.id)} color="gray" sm>Open Item</Btn>
          </div>
          <div style={{marginTop:12,fontSize:12,fontWeight:800}}>Possible lots</div>
          {review.candidates.length===0&&<div style={{marginTop:8,background:"#fef2f2",color:"#991b1b",borderRadius:8,padding:10,fontSize:12}}>Nenhum candidato confiável. Abra o item e preencha invoice/lote/custo manualmente quando souber.</div>}
          <div style={{display:"grid",gap:8,marginTop:8}}>
            {review.candidates.map(c=>{
              const active=chosen&&chosen.invoice===c.invoice&&chosen.lot===c.lot;
              return <button key={c.invoice+"-"+c.lot} onClick={()=>{setSelected({...selected,[item.id]:c});setCosts({...costs,[item.id]:c.total});}} style={{textAlign:"left",background:active?"#eff6ff":"#f8fafc",border:"1px solid "+(active?"#93c5fd":"#e5e7eb"),borderRadius:9,padding:10,cursor:"pointer",fontFamily:"inherit"}}>
                <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                  <span style={{fontFamily:"monospace",fontWeight:900,color:"#1d4ed8"}}>{c.invoice} · Lot {c.lot}</span>
                  <span style={{fontWeight:900,color:"#d97706"}}>{money(c.total)}</span>
                </div>
                <div style={{fontSize:11,color:"#374151",marginTop:5,lineHeight:1.35}}>{c.description}</div>
              </button>;
            })}
          </div>
          {chosen&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10,marginTop:12,alignItems:"end"}}>
            <FG label="Cost to assign to this product"><Inp val={assigned} set={v=>setCosts({...costs,[item.id]:v})} type="number"/></FG>
            <div style={{fontSize:12,color:"#6b7280"}}>Unit cost preview: <b>{money((parseFloat(assigned)||0)/(parseFloat(item.qty)||1))}</b><br/>Use full lot cost only when this product is the whole lot.</div>
            <Btn click={()=>applyChoice(item,review)} color="green">Save Link + Cost</Btn>
          </div>}
        </div>;
      })}
    </div>
    {visible.length===0&&<div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,padding:24,textAlign:"center",color:"#6b7280"}}>No pending items in this filter.</div>}
  </div>;
}

function ERPApp({userEmail,onLogout}) {
  const [items,setItems]=useState([]);
  const [tab,setTab]=useState("dashboard");
  const [detailId,setDetailId]=useState(null);
  const [sellId,setSellId]=useState(null);
  const [editItem,setEditItem]=useState(null);
  const [search,setSearch]=useState("");
  const [stFlt,setStFlt]=useState("all");
  const [toast,setToast]=useState(null);
  const [loaded,setLoaded]=useState(false);
  const [cloudOk,setCloudOk]=useState(false);
  const [reviewData,setReviewData]=useState([]);
  const itemsRef=useRef([]);
  const editingRef=useRef(false);

  useEffect(()=>{itemsRef.current=items;},[items]);
  useEffect(()=>{editingRef.current=!!editItem||!!sellId;},[editItem,sellId]);
  useEffect(()=>{setReviewData(items.filter(i=>i._reviewCandidates).map(i=>i._reviewCandidates));},[items]);

  useEffect(()=>{
    (async()=>{
      try {
        const cloudCopies=await cloudLoadCopies();
        const cloud=cloudCopies?mergeInventories(...cloudCopies):null;
        if(cloud){deletedSave({});setItems(cloud);setCloudOk(true);}
        else {setItems([]);setCloudOk(false);}
      } catch {setItems([]);setCloudOk(false);}
      setLoaded(true);
    })();
  },[]);

  useEffect(()=>{
    if(!loaded)return;
    const sync=async()=>{
      const cloudCopies=await cloudLoadCopies();
      const cloud=cloudCopies?mergeInventories(...cloudCopies):null;
      if(!cloud){setCloudOk(false);return;}
      setCloudOk(true);
      const current=itemsRef.current;
      const merged=mergeInventories(cloud,current);
      if(editingRef.current||sameItems(merged,current))return;
      if(dataScore(current)>=dataScore(cloud)){
        const ok=await cloudSave(merged);
        setCloudOk(ok);
        if(ok){setItems(merged);localSave(merged);toast$("Sent local updates to cloud: "+merged.length+" products");}
        return;
      }
      if(dataScore(cloud)>dataScore(current)){
        setItems(merged);
        localSave(merged);
        toast$("Updated from cloud: "+merged.length+" products");
      }
    };
    const timer=setInterval(sync,10000);
    return()=>clearInterval(timer);
  },[loaded]);

  async function persist(data){setItems(data);localSave(data);const ok=await cloudSave(data);setCloudOk(ok);return ok;}
  function toast$(msg,ok=true){setToast({msg,ok});setTimeout(()=>setToast(null),3500);}
  async function saveItem(upd){const stamped={...upd,_syncAt:new Date().toISOString()};const exists=items.find(i=>i.id===stamped.id);const ok=await persist(exists?items.map(i=>i.id===stamped.id?stamped:i):[...items,stamped]);setEditItem(null);setDetailId(null);toast$(ok?"Saved to cloud: "+stamped.id:"Saved only on this device: "+stamped.id,ok);}
  async function saveSale(upd){const stamped={...upd,_syncAt:new Date().toISOString()};const ok=await persist(items.map(i=>i.id===stamped.id?stamped:i));setSellId(null);toast$(ok?"Sale recorded in cloud!":"Sale saved only on this device",ok);}
  async function deleteItem(item){if(!confirm("Delete "+item.id+"? This removes it from all synced devices."))return;const d=deletedLoad();d[item.id]=new Date().toISOString();deletedSave(d);const ok=await persist(items.filter(i=>i.id!==item.id));setEditItem(null);setDetailId(null);setSellId(null);toast$(ok?"Deleted from sync: "+item.id:"Deleted only on this device: "+item.id,ok);}
  async function applyReviewCost(item,candidate,assignedCost,review){const qty=parseFloat(item.qty)||1;const note=`Cost review ${today()}: linked to ${candidate.invoice} lot ${candidate.lot}; assigned ${money(assignedCost)} from lot total ${money(candidate.total)}.`;const upd={...item,supplier:item.supplier||"Michigan Industrial Auctions",invoice:candidate.invoice,lots:candidate.lot,costTotal:parseFloat(assignedCost.toFixed(2)),costUnit:parseFloat((assignedCost/qty).toFixed(2)),notes:[item.notes,note].filter(Boolean).join("\\n"),_reviewQuestion:review.question};await saveItem(upd);}
  function startNew(){setEditItem({id:nextId(items),name:"",sku:"",cat:"Industrial Automation",cond:"uw",qty:1,qtyInStock:1,qtySold:0,supplier:"",invoice:"",lots:"",bought:today(),received:"",listed:"",rack:1,shelf:1,pos:1,notes:"",channel:"ebay",listP:"",listUrl:"",costTotal:"",costUnit:"",status:"purchased",sales:[]});setDetailId(null);}
  function dupItem(item){setEditItem({...item,id:nextId(items),sales:[],qtySold:0,status:"received",listed:"",_dup:true});setDetailId(null);}
  function exportData(){const blob=new Blob([JSON.stringify(items,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="mp-erp-"+today()+".json";a.click();URL.revokeObjectURL(url);toast$("Backup downloaded!");}
  function importFile(e){const file=e.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=async ev=>{try{const data=JSON.parse(ev.target.result);if(!Array.isArray(data))throw new Error();const ok=await persist(data);toast$(ok?data.length+" items loaded in cloud!":data.length+" items loaded only on this device",ok);}catch{toast$("Invalid file",false);}};reader.readAsText(file);e.target.value="";}

  const detailItem=detailId?items.find(i=>i.id===detailId):null;
  const sellItem=sellId?items.find(i=>i.id===sellId):null;
  const totalNet=items.reduce((a,i)=>a+calcPL(i).net,0);
  const stockVal=items.reduce((a,i)=>a+calcPL(i).cu*(i.qtyInStock||0),0);
  const totalSold=items.reduce((a,i)=>a+(i.qtySold||0),0);
  const totalStock=items.reduce((a,i)=>a+(i.qtyInStock||0),0);
  const filtered=items.filter(i=>{if(stFlt!=="all"&&i.status!==stFlt)return false;if(search){const q=search.toLowerCase();return i.name.toLowerCase().includes(q)||i.id.toLowerCase().includes(q)||(i.sku||"").toLowerCase().includes(q)||(i.invoice||"").toLowerCase().includes(q);}return true;});
  const TABS=[{id:"dashboard",icon:"📊",label:"Dashboard"},{id:"inventory",icon:"📦",label:"Inventory"},{id:"review",icon:"🧾",label:"Review"},{id:"map",icon:"🗺",label:"Warehouse"},{id:"analytics",icon:"📈",label:"Analytics"}];

  if(!loaded)return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",flexDirection:"column",gap:16,color:"#888",fontFamily:"system-ui"}}><div style={{fontSize:48}}>☁</div><div style={{fontSize:18,fontWeight:700}}>Loading 77 products...</div></div>;

  return <div style={{fontFamily:"system-ui,-apple-system,sans-serif",minHeight:"100vh",background:"#f4f5f7",color:"#111"}}>
    {toast&&<div style={{position:"fixed",top:16,right:16,zIndex:9999,background:toast.ok?"#1a1a2e":"#dc2626",color:"#fff",padding:"10px 20px",borderRadius:10,fontSize:13,fontWeight:600,boxShadow:"0 4px 24px rgba(0,0,0,0.3)",maxWidth:340}}>{toast.msg}</div>}
    {sellItem&&<SellModal item={sellItem} onClose={()=>setSellId(null)} onSave={saveSale}/>}
    {editItem&&<EditModal item={editItem} onClose={()=>setEditItem(null)} onSave={saveItem}/>}
    {detailItem&&!sellId&&!editItem&&<Drawer item={detailItem} onClose={()=>setDetailId(null)} onEdit={()=>{setEditItem(detailItem);setDetailId(null);}} onSell={()=>{setSellId(detailItem.id);setDetailId(null);}} onDup={()=>dupItem(detailItem)} onDelete={()=>deleteItem(detailItem)}/>}

    <div style={{background:"#1a1a2e",color:"#fff",padding:"0 20px"}}>
      <div style={{maxWidth:980,margin:"0 auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 0 10px",flexWrap:"wrap",gap:10}}>
          <div>
            <div style={{fontSize:10,letterSpacing:"0.18em",color:"#6b7280",textTransform:"uppercase"}}>MP Business Strategy LLC · S-Corp · FL/SC</div>
            <div style={{fontSize:20,fontWeight:900}}>Inventory + Warehouse ERP</div>
            <div style={{display:"flex",alignItems:"center",gap:8,marginTop:2}}>
              <span style={{fontSize:11,color:"#6b7280"}}>{items.length} products · {totalStock} in stock · {totalSold} sold</span>
              <span style={{fontSize:11,fontWeight:700,color:cloudOk?"#4ade80":"#fbbf24",background:"rgba(255,255,255,0.1)",padding:"2px 8px",borderRadius:20}}>{cloudOk?"☁ Sync ON":"⚠ Local only"} · {SYNC_VERSION}</span>
            </div>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
            <button onClick={startNew} style={{padding:"8px 14px",background:"#f59e0b",border:"none",borderRadius:8,color:"#000",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>+ Add</button>
            <button onClick={exportData} style={{padding:"8px 14px",background:"#2563eb",border:"none",borderRadius:8,color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>Export</button>
            <label style={{padding:"8px 14px",background:"#16a34a",borderRadius:8,color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit",display:"inline-block"}}>Import<input type="file" accept=".json" onChange={importFile} style={{display:"none"}}/></label>
            <button onClick={onLogout} title={userEmail} style={{padding:"8px 14px",background:"#374151",border:"1px solid #4b5563",borderRadius:8,color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>Logout</button>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:10,color:"#6b7280",textTransform:"uppercase"}}>Net Profit (28.5%)</div>
              <div style={{fontSize:22,fontWeight:900,color:"#4ade80"}}>{money(totalNet)}</div>
            </div>
          </div>
        </div>
        <div style={{display:"flex",overflowX:"auto",borderTop:"1px solid #2d2d4e"}}>
          {TABS.map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"10px 18px",background:"transparent",border:"none",color:tab===t.id?"#fff":"#6b7280",fontSize:13,fontWeight:tab===t.id?700:400,cursor:"pointer",borderBottom:tab===t.id?"2px solid #f59e0b":"2px solid transparent",fontFamily:"inherit",whiteSpace:"nowrap"}}>{t.icon} {t.label}</button>)}
        </div>
      </div>
    </div>

    <div style={{maxWidth:980,margin:"0 auto",padding:"20px 16px 60px"}}>
      {tab==="dashboard"&&<div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(150px, 1fr))",gap:10,marginBottom:20}}>
          {[{l:"Net Profit (28.5%)",v:money(totalNet),s:totalSold+" units sold",c:"#16a34a",bg:"#f0fdf4"},{l:"Capital in Stock",v:money(stockVal),s:totalStock+" units",c:"#d97706",bg:"#fffbeb"},{l:"Products",v:items.length,s:"registered",c:"#2563eb",bg:"#eff6ff"},{l:"Tax Reserve",v:money(items.reduce((a,i)=>a+calcPL(i).taxAmt,0)),s:"S-Corp FL/SC",c:"#dc2626",bg:"#fef2f2"},{l:"Est. Potential",v:money(items.reduce((a,i)=>a+calcPL(i).eN*(i.qtyInStock||0),0)),s:"all at list price",c:"#7c3aed",bg:"#f5f3ff"}].map((k,i)=>(
            <div key={i} style={{background:k.bg,border:"1px solid "+k.c+"22",borderRadius:10,padding:"14px 16px"}}>
              <div style={{fontSize:10,color:"#6b7280",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>{k.l}</div>
              <div style={{fontSize:20,fontWeight:900,color:k.c,marginBottom:2}}>{k.v}</div>
              <div style={{fontSize:11,color:"#9ca3af"}}>{k.s}</div>
            </div>
          ))}
        </div>
        <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,overflow:"hidden"}}>
          <div style={{background:"#f8fafc",borderBottom:"1px solid #e5e7eb",padding:"12px 16px",fontWeight:700,fontSize:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span>All Products ({items.length})</span>
            <button onClick={()=>setTab("inventory")} style={{padding:"5px 12px",background:"#f3f4f6",border:"none",borderRadius:6,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>View All</button>
          </div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead><tr style={{background:"#f8fafc"}}>{["ID","Product","Location","Stock","Sold","Est.Net/Unit","Status","Action"].map(h=><th key={h} style={{padding:"8px 12px",textAlign:"left",fontWeight:600,fontSize:10,color:"#6b7280",textTransform:"uppercase",borderBottom:"1px solid #e5e7eb",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
              <tbody>{items.map((it,idx)=>{const c=calcPL(it);return(
                <tr key={it.id} onClick={()=>setDetailId(it.id)} style={{borderBottom:"0.5px solid #f3f4f6",cursor:"pointer",background:idx%2===0?"#fff":"#fafafa"}} onMouseEnter={e=>e.currentTarget.style.background="#eff6ff"} onMouseLeave={e=>e.currentTarget.style.background=idx%2===0?"#fff":"#fafafa"}>
                  <td style={{padding:"9px 12px",fontFamily:"monospace",fontWeight:700,color:"#1a1a2e"}}>{it.id}</td>
                  <td style={{padding:"9px 12px",fontWeight:600,maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{it.name}</td>
                  <td style={{padding:"9px 12px"}}><span style={{fontFamily:"monospace",fontSize:12,background:"#f3f4f6",padding:"2px 8px",borderRadius:20,fontWeight:700}}>{loc(it)}</span></td>
                  <td style={{padding:"9px 12px",textAlign:"center"}}><span style={{background:it.qtyInStock===0?"#dcfce7":it.qtyInStock<=2?"#fef3c7":"#dbeafe",color:it.qtyInStock===0?"#166534":it.qtyInStock<=2?"#92400e":"#1d4ed8",padding:"2px 10px",borderRadius:20,fontWeight:700}}>{it.qtyInStock}</span></td>
                  <td style={{padding:"9px 12px",textAlign:"center"}}><span style={{background:it.qtySold>0?"#dcfce7":"#f3f4f6",color:it.qtySold>0?"#166534":"#9ca3af",padding:"2px 10px",borderRadius:20,fontWeight:700}}>{it.qtySold}</span></td>
                  <td style={{padding:"9px 12px",fontWeight:700,color:c.eN>=0?"#16a34a":"#dc2626"}}>{money(c.eN)}</td>
                  <td style={{padding:"9px 12px"}}><STag status={it.status}/></td>
                  <td style={{padding:"9px 12px"}} onClick={e=>e.stopPropagation()}><Btn click={()=>deleteItem(it)} color="gray" sm>Delete</Btn></td>
                </tr>
              );})}
              </tbody>
            </table>
          </div>
        </div>
      </div>}

      {tab==="inventory"&&<div>
        <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, ID, SKU, invoice..." style={{flex:1,minWidth:200,padding:"10px 14px",border:"1px solid #e5e7eb",borderRadius:8,fontSize:13,outline:"none",fontFamily:"inherit",background:"#fff"}}/>
          <Sel val={stFlt} set={setStFlt} opts={[["all","All Status"],...Object.entries(ST).map(([k,v])=>[k,v.icon+" "+v.l])]}/>
          <Btn click={startNew} color="dark">+ Add Item</Btn>
        </div>
        <div style={{fontSize:12,color:"#888",marginBottom:12}}>{filtered.length} items · {totalStock} in stock · {totalSold} sold</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))",gap:10}}>
          {filtered.map(item=>{const c=calcPL(item);const days=item.received&&item.status!=="sold"?Math.ceil((new Date().getTime()-new Date(item.received).getTime())/86400000):null;
            return <div key={item.id} onClick={()=>setDetailId(item.id)} style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:10,padding:14,cursor:"pointer"}} onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 2px 16px rgba(0,0,0,0.08)";e.currentTarget.style.borderColor="#bfdbfe";}} onMouseLeave={e=>{e.currentTarget.style.boxShadow="none";e.currentTarget.style.borderColor="#e5e7eb";}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}><span style={{fontFamily:"monospace",fontWeight:900,fontSize:14,color:"#1a1a2e"}}>{item.id}</span><STag status={item.status}/></div>
              <div style={{fontWeight:600,fontSize:13,lineHeight:1.3,marginBottom:8}}>{item.name}</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
                <span style={{fontSize:10,background:"#f3f4f6",color:"#374151",padding:"2px 8px",borderRadius:20,fontFamily:"monospace",fontWeight:700}}>📍 {loc(item)}</span>
                {days!=null&&<span style={{fontSize:10,color:days>60?"#dc2626":days>30?"#d97706":"#16a34a"}}>{days}d in stock</span>}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:10}}>
                {[{l:"Stock",v:item.qtyInStock,c:"#2563eb",bg:"#dbeafe"},{l:"Sold",v:item.qtySold,c:"#16a34a",bg:"#dcfce7"},{l:"Est.Net",v:money(c.eN),c:c.eN>=0?"#16a34a":"#dc2626",bg:"#f8fafc"}].map((x,i)=>(
                  <div key={i} style={{background:x.bg,borderRadius:6,padding:"5px 8px",textAlign:"center"}}><div style={{fontSize:9,color:"#6b7280",textTransform:"uppercase"}}>{x.l}</div><div style={{fontWeight:800,fontSize:13,color:x.c}}>{x.v}</div></div>
                ))}
              </div>
              <div style={{display:"flex",gap:6}} onClick={e=>e.stopPropagation()}>
                {item.qtyInStock>0&&<Btn click={()=>setSellId(item.id)} color="green" sm full>Record Sale</Btn>}
                <Btn click={()=>dupItem(item)} color="purple" sm>Dup</Btn>
                <Btn click={()=>deleteItem(item)} color="gray" sm>Delete</Btn>
              </div>
            </div>;
          })}
        </div>
      </div>}

      {tab==="map"&&<WMap items={items} onSelect={id=>setDetailId(id)}/>}

      {tab==="review"&&<CostReview items={items} reviewData={reviewData} onApply={applyReviewCost} onOpen={id=>setDetailId(id)}/>}

      {tab==="analytics"&&<div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(150px, 1fr))",gap:10,marginBottom:20}}>
          {[{l:"Total Invested",v:money(items.reduce((a,i)=>a+calcPL(i).totalCostIn,0)),c:"#dc2626"},{l:"Revenue (sold)",v:money(items.reduce((a,i)=>a+calcPL(i).rev,0)),c:"#16a34a"},{l:"Gross Profit",v:money(items.reduce((a,i)=>a+calcPL(i).gross,0)),c:"#d97706"},{l:"Tax Reserve",v:money(items.reduce((a,i)=>a+calcPL(i).taxAmt,0)),c:"#dc2626"},{l:"Net Profit",v:money(totalNet),c:"#16a34a"}].map((k,i)=>(
            <div key={i} style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:10,padding:14}}><div style={{fontSize:10,color:"#6b7280",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>{k.l}</div><div style={{fontSize:20,fontWeight:900,color:k.c}}>{k.v}</div></div>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,overflow:"hidden"}}>
            <div style={{background:"#f8fafc",borderBottom:"1px solid #e5e7eb",padding:"12px 16px",fontWeight:700,fontSize:14}}>🏆 Best Margin / Unit</div>
            <div style={{padding:"0 16px"}}>
              {[...items].sort((a,b)=>calcPL(b).eN-calcPL(a).eN).slice(0,8).map((it,i)=>{const c=calcPL(it);return(
                <div key={it.id} onClick={()=>setDetailId(it.id)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:"0.5px solid #f3f4f6",cursor:"pointer"}}>
                  <div><span style={{fontWeight:900,color:"#f59e0b",marginRight:6}}>#{i+1}</span><span style={{fontWeight:600}}>{it.id}</span><div style={{fontSize:11,color:"#888"}}>{it.name.split(" ").slice(0,4).join(" ")} · x{it.qtyInStock}</div></div>
                  <div style={{textAlign:"right"}}><div style={{fontWeight:800,color:c.eN>=0?"#16a34a":"#dc2626"}}>{money(c.eN)}</div><div style={{fontSize:11,color:c.eM>=120?"#16a34a":"#d97706"}}>{pct(c.eM)}</div></div>
                </div>
              );})}
            </div>
          </div>
          <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,overflow:"hidden"}}>
            <div style={{background:"#f8fafc",borderBottom:"1px solid #e5e7eb",padding:"12px 16px",fontWeight:700,fontSize:14}}>⏱ Longest in Stock</div>
            <div style={{padding:"0 16px"}}>
              {[...items.filter(i=>i.received&&i.qtyInStock>0)].map(i=>({...i,days:Math.ceil((new Date().getTime()-new Date(i.received).getTime())/86400000)})).sort((a,b)=>b.days-a.days).slice(0,8).map(it=>(
                <div key={it.id} onClick={()=>setDetailId(it.id)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:"0.5px solid #f3f4f6",cursor:"pointer"}}>
                  <div><span style={{fontWeight:600}}>{it.id}</span><div style={{fontSize:11,color:"#888"}}>{it.name.split(" ").slice(0,4).join(" ")}</div></div>
                  <div style={{textAlign:"right"}}><div style={{fontWeight:800,color:it.days>60?"#dc2626":it.days>30?"#d97706":"#16a34a"}}>{it.days}d</div><div style={{fontSize:11,color:"#888"}}>x{it.qtyInStock} left</div></div>
                </div>
              ))}
              <div style={{background:"#fffbeb",borderRadius:8,padding:"8px 12px",margin:"10px 0",fontSize:12,color:"#78350f"}}>Items over 60 days: consider reducing price 10-15%.</div>
            </div>
          </div>
        </div>
      </div>}
    </div>
  </div>;
}


function LoginScreen() {
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  async function submit(e){
    e.preventDefault();setBusy(true);setError("");
    const {error:signInError}=await supabase.auth.signInWithPassword({email:email.trim(),password});
    if(signInError)setError("E-mail ou senha incorretos.");
    setBusy(false);
  }
  return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:20,background:"#1a1a2e",fontFamily:"system-ui,-apple-system,sans-serif"}}>
    <form onSubmit={submit} style={{width:"100%",maxWidth:390,background:"#fff",borderRadius:12,padding:28,boxShadow:"0 20px 60px rgba(0,0,0,.35)"}}>
      <div style={{fontSize:11,letterSpacing:".16em",color:"#6b7280",textTransform:"uppercase",marginBottom:8}}>Maxor Industrial</div>
      <h1 style={{fontSize:25,margin:"0 0 6px",color:"#111827"}}>Acesso ao ERP</h1>
      <p style={{fontSize:13,color:"#6b7280",margin:"0 0 22px"}}>Entre com seu e-mail e senha autorizados.</p>
      <label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:6}}>E-mail</label>
      <input autoComplete="username" type="email" required value={email} onChange={e=>setEmail(e.target.value)} style={{width:"100%",boxSizing:"border-box",padding:"11px 12px",border:"1px solid #d1d5db",borderRadius:8,fontSize:15,color:"#111827",marginBottom:14}}/>
      <label style={{display:"block",fontSize:12,fontWeight:700,color:"#374151",marginBottom:6}}>Senha</label>
      <input autoComplete="current-password" type="password" required value={password} onChange={e=>setPassword(e.target.value)} style={{width:"100%",boxSizing:"border-box",padding:"11px 12px",border:"1px solid #d1d5db",borderRadius:8,fontSize:15,color:"#111827",marginBottom:10}}/>
      {error&&<div role="alert" style={{fontSize:12,color:"#b91c1c",background:"#fef2f2",border:"1px solid #fecaca",borderRadius:7,padding:"9px 10px",marginBottom:12}}>{error}</div>}
      <button type="submit" disabled={busy} style={{width:"100%",padding:"11px 14px",border:0,borderRadius:8,background:busy?"#9ca3af":"#2563eb",color:"#fff",fontSize:15,fontWeight:800,cursor:busy?"wait":"pointer"}}>{busy?"Entrando...":"Entrar"}</button>
    </form>
  </div>;
}

export default function App(){
  const [session,setSession]=useState(null);
  const [checking,setChecking]=useState(true);
  useEffect(()=>{
    let active=true;
    (async()=>{
      const {data:{session:stored}}=await supabase.auth.getSession();
      if(!stored){if(active){setSession(null);setChecking(false);}return;}
      const {data,error}=await supabase.auth.getUser();
      if(active){setSession(!error&&data.user?stored:null);setChecking(false);}
    })();
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>{if(active){setSession(next);setChecking(false);}});
    return()=>{active=false;subscription.unsubscribe();};
  },[]);
  useEffect(()=>{
    if(checking)return;
    const target=session?"/":"/login";
    if(location.pathname!==target)history.replaceState({},"",target);
  },[checking,session]);
  async function logout(){
    await supabase.auth.signOut({scope:"global"});
    localStorage.removeItem("mp_erp_77");
    localStorage.removeItem("mp_erp_deleted");
    setSession(null);
  }
  if(checking)return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#1a1a2e",color:"#fff",fontFamily:"system-ui"}}>Verificando acesso...</div>;
  if(!session)return <LoginScreen/>;
  return <ERPApp userEmail={session.user?.email||""} onLogout={logout}/>;
}
