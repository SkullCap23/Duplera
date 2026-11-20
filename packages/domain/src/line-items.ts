import {z} from 'zod';
export const lineItemSchema=z.object({
 code:z.string().trim().min(1).max(80),description:z.string().trim().min(1).max(300),
 quantity:z.string().regex(/^(?:0|[1-9]\d{0,8})(?:\.\d{1,4})?$/).refine(v=>/[1-9]/.test(v),'Quantity must be positive'),
 unitPriceMinor:z.string().regex(/^(?:0|[1-9]\d{0,17})$/),
 totalMinor:z.string().regex(/^[1-9]\d{0,17}$/),
});
export const lineItemsSchema=z.array(lineItemSchema).min(1).max(30).superRefine((items,ctx)=>{
 for(const [i,item]of items.entries()){
  const [whole,frac='']=item.quantity.split('.'),scale=10n**BigInt(frac.length);
  const quantity=BigInt(whole)*scale+BigInt(frac||'0');
  const expected=(quantity*BigInt(item.unitPriceMinor)+scale/2n)/scale;
  if(expected!==BigInt(item.totalMinor))ctx.addIssue({code:'custom',path:[i,'totalMinor'],message:'Line total must equal quantity × unit price, rounded to nearest minor unit'});
 }
});
export type LineItem=z.infer<typeof lineItemSchema>;
export function parseLineItems(value:string){return lineItemsSchema.parse(JSON.parse(value));}
export function canonicalLineItems(value:string){
 return JSON.stringify(parseLineItems(value).map(item=>({...item,quantity:item.quantity.includes('.')?item.quantity.replace(/0+$/,'').replace(/\.$/,''):item.quantity,code:item.code.normalize('NFKC').trim().toUpperCase(),description:item.description.normalize('NFKC').trim().replace(/\s+/g,' ').toUpperCase()})).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b),'en')));
}
export function lineItemOverlap(a:string|undefined,b:string|undefined){
 if(!a||!b)return null;
 const left=parseLineItems(canonicalLineItems(a)),right=parseLineItems(canonicalLineItems(b));
 const bag=(items:LineItem[])=>{const result=new Map<string,number>();for(const item of items){const key=JSON.stringify(item);result.set(key,(result.get(key)??0)+1)}return result};
 const x=bag(left),y=bag(right);let overlap=0;
 for(const[key,count]of x)overlap+=Math.min(count,y.get(key)??0);
 return 2*overlap/(left.length+right.length);
}
