import {PDFDocument,StandardFonts,rgb} from "pdf-lib";
import {mkdir,writeFile,readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {fieldLabels} from '../packages/domain/src/extraction';
import type {Invoice} from '@duplera/domain';
const count=Number(process.argv[2]??1000);if(!Number.isInteger(count)||count<1||count>5000)throw new Error("Count must be 1–5000");
await mkdir("data/synthetic",{recursive:true});
let seed=20261024;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/2**32};
const manifest:unknown[]=[];
let tradeContext:any;try{tradeContext=JSON.parse(await readFile('data/reference/trade-context.json','utf8'))}catch{}
for(let i=0;i<count;i++){
  const entityHeldOut=i%10===0;
  const family=`family-${String(i).padStart(5,"0")}`,supplier=(entityHeldOut?80:0)+Math.floor(random()*(entityHeldOut?20:80)),buyer=(entityHeldOut?100:0)+Math.floor(random()*(entityHeldOut?20:100));
  const base={supplierCountry:"IN",supplierIdentifierType:"SYNTHETIC_TAX_ID",supplierIdentifier:`SYN-SUP-${supplier}`,supplierName:`Synthetic Supplier ${supplier}`,buyerIdentifier:`SYN-BUY-${buyer}`,buyerName:`Synthetic Buyer ${buyer}`,invoiceNumberNamespace:"FY2026",invoiceNumber:`INV-2026-${String(i).padStart(5,"0")}`,invoiceDate:`2026-10-${String(1+Math.floor(random()*28)).padStart(2,"0")}`,currency:"INR",amountMinor:String(10000+Math.floor(random()*9900000)),description:["Cotton fabric 500 rolls","Steel fasteners 200 boxes","Electronic components 80 cartons"][i%3]};
  const route=i%3===0?tradeContext?.routes?.[0]:undefined;
  if(route)base.description=`HS ${route.commodityCode}: ${route.commodity.slice(0,45)} | synthetic lot`;
  const split=entityHeldOut?'entity-held-out':i%5===0?"held-out":"development";
  for(const [variant,invoice] of [["base",base],["layout",base],["amount",{...base,amountMinor:String(BigInt(base.amountMinor)+5000n)}],["date",{...base,invoiceDate:'2026-11-01'}],["amendment",{...base,amountMinor:String(BigInt(base.amountMinor)+100n),description:base.description+' amended'}],["recurring",{...base,invoiceNumber:base.invoiceNumber+'-NEXT',invoiceDate:'2026-11-01'}],["number",{...base,invoiceNumber:base.invoiceNumber+"A"}],["supplier",{...base,supplierIdentifier:`SYN-SUP-ALTERED-${supplier}`}],["multi",{...base,invoiceNumber:`ALT-${i}`,supplierIdentifier:`SYN-OTHER-${supplier}`,buyerIdentifier:`SYN-OTHER-BUYER-${buyer}`,description:"Unrelated service"}]] as const){
    const pdf=await PDFDocument.create(),page=pdf.addPage([595,842]);const font=await pdf.embedFont(StandardFonts.Helvetica);const layout=(i+(variant==="layout"?1:0))%3;
    page.drawRectangle({x:0,y:770,width:595,height:72,color:layout===0?rgb(.13,.32,.24):layout===1?rgb(.15,.23,.4):rgb(.35,.24,.2)});
    page.drawText("SYNTHETIC COMMERCIAL INVOICE",{x:35,y:800,size:17,font,color:rgb(1,1,1)});
    page.drawText(`Layout ${layout+1} | Not a real trade document`,{x:35,y:750,size:10,font});
    const entries=Object.entries(invoice);if(layout===2)entries.reverse();entries.forEach(([k,v],j)=>page.drawText(`${layout===0?k:fieldLabels[k as keyof Invoice]}: ${v}`,{x:35+layout*4,y:710-j*37,size:10,font}));
    pdf.setCreationDate(new Date("2026-10-24T00:00:00Z"));pdf.setModificationDate(new Date("2026-10-24T00:00:00Z"));
    const bytes=await pdf.save(),filename=`${family}-${variant}.pdf`;await writeFile(`data/synthetic/${filename}`,bytes);
    manifest.push({family,split,variant,filename,layout:layout+1,tradeContext:route??null,relationship:variant==="base"?"original":variant==='recurring'?'distinct_invoice':variant==='amendment'?'legitimate_amendment':"same_underlying_invoice",sha256:createHash("sha256").update(bytes).digest("hex"),groundTruth:invoice});
    if(variant==="base")manifest.push({family,split,variant:"exact",filename,relationship:"same_underlying_invoice",sha256:createHash("sha256").update(bytes).digest("hex"),groundTruth:invoice});
  }
}
await writeFile("data/synthetic/manifest.json",JSON.stringify({seed:20261024,count,provenance:tradeContext?'Synthetic invoices; selected commodity descriptions inspired by cached aggregate UN Comtrade context. Prices, entities and fraud labels are invented.':'Entirely synthetic; no Comtrade data or real transactions used',tradeContextSource:tradeContext?.url??null,records:manifest},null,2));
console.log(`Generated ${count} invoice families with 3 layouts and family-grouped splits.`);
