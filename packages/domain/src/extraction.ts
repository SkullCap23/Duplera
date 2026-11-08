import type {Invoice} from './index';
export const fieldLabels:Record<keyof Invoice,string>={supplierCountry:'Supplier country',supplierIdentifierType:'Supplier identifier type',supplierIdentifier:'Supplier ID',supplierName:'Supplier name',buyerIdentifier:'Buyer ID',buyerName:'Buyer name',invoiceNumberNamespace:'Invoice namespace',invoiceNumber:'Invoice number',invoiceDate:'Invoice date',currency:'Currency',amountMinor:'Amount (minor units)',description:'Description'};
const aliases:Record<keyof Invoice,string[]>={supplierCountry:['Supplier country'],supplierIdentifierType:['Supplier identifier type','Supplier ID type'],supplierIdentifier:['Supplier ID','Supplier identifier'],supplierName:['Supplier name','Seller name'],buyerIdentifier:['Buyer ID','Buyer identifier'],buyerName:['Buyer name','Customer name'],invoiceNumberNamespace:['Invoice namespace','Number namespace'],invoiceNumber:['Invoice number','Invoice no.','Invoice #'],invoiceDate:['Invoice date','Issue date'],currency:['Currency'],amountMinor:['Amount (minor units)','Total minor units'],description:['Description','Goods description']};
const escape=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export function extractInvoiceFields(text:string){
 const fields=Object.fromEntries(Object.keys(aliases).map(k=>[k,''])) as Invoice;
 const warnings:string[]=[];
 for(const key of Object.keys(aliases) as (keyof Invoice)[]){
  const names=[key,...aliases[key]].map(escape).join('|');
  const matches=[...text.matchAll(new RegExp('(?:^|\\n)\\s*(?:'+names+')\\s*[:：]\\s*([^\\n]+)','gi'))];
  const values=[...new Set(matches.map(m=>m[1].trim()))];
  if(values.length===1)fields[key]=values[0];else if(values.length>1)warnings.push('Conflicting values for '+fieldLabels[key]);
 }
 const missing=(Object.keys(fields) as (keyof Invoice)[]).filter(k=>!fields[k]);
 if(missing.length)warnings.push('Confirm missing fields: '+missing.map(k=>fieldLabels[k]).join(', '));
 return {fields,warnings};
}
