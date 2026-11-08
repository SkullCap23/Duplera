import {mkdir,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
const parameters={period:'2023',reporterCode:'699',cmdCode:'5208',flowCode:'X',partnerCode:'842',partner2Code:'0',customsCode:'C00',motCode:'0',maxRecords:'5',includeDesc:'true'};
const url='https://comtradeapi.un.org/public/v1/preview/C/A/HS?'+new URLSearchParams(parameters);
await mkdir('data/reference',{recursive:true});
const provenance={source:'UN Comtrade',attribution:'Source: UN Comtrade',retrievedAt:new Date().toISOString(),url,parameters,typeCode:'C',frequency:'A',classificationRequested:'HS',policy:'https://uncomtrade.org/docs/re-dissemination-of-data/',purpose:'Small non-commercial course demonstration; aggregate context only, never invoice or fraud ground truth'};
try{
 const response=await fetch(url,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error('Preview API HTTP '+response.status);
 const text=await response.text(),body=JSON.parse(text);if(!Array.isArray(body.data)||body.data.length===0||body.data.length>5)throw new Error('No usable bounded data returned');
 const routes=body.data.map((r:any,index:number)=>({id:index,period:r.period,reporterCode:r.reporterCode,reporter:r.reporterDesc,partnerCode:r.partnerCode,partner:r.partnerDesc,commodityCode:r.cmdCode,commodity:r.cmdDesc,classification:r.classificationCode}));
 if(routes.some((r:any)=>!r.reporter||!r.partner||!r.commodity))throw new Error('Preview did not return descriptive context');
 await writeFile('data/reference/comtrade-preview.json',JSON.stringify({...provenance,sha256:createHash('sha256').update(text).digest('hex'),records:body.data},null,2));
 await writeFile('data/reference/trade-context.json',JSON.stringify({...provenance,transformation:'Keep reporter, partner, commodity and classification metadata; do not infer invoice prices, counterparties or fraud labels',routes},null,2));
 await writeFile('data/reference/comtrade-status.json',JSON.stringify({...provenance,status:'CACHED',records:routes.length},null,2));console.log('Cached '+routes.length+' aggregate UN Comtrade records with attribution and provenance.');
}catch(e){await writeFile('data/reference/comtrade-status.json',JSON.stringify({...provenance,status:'UNAVAILABLE',reason:e instanceof Error?e.message:String(e)},null,2));throw e;}
