import {z} from 'zod';
import {keccak256,toUtf8Bytes,verifyTypedData,getAddress,ZeroHash} from 'ethers';
import {invoiceSchema,canonicalise,identity,normalise} from './index';
export const supplierTypes={SupplierAuthorization:[{name:'issuer',type:'address'},{name:'country',type:'string'},{name:'identifierType',type:'string'},{name:'identifier',type:'string'},{name:'active',type:'bool'},{name:'revision',type:'uint64'},{name:'deadline',type:'uint64'}]};
export const issueTypes={InvoiceVersion:[{name:'issuer',type:'address'},{name:'receivableId',type:'string'},{name:'version',type:'uint32'},{name:'previousDigest',type:'bytes32'},{name:'invoiceDigest',type:'bytes32'}]};
export const issuanceDomain=(chainId:number,address:string)=>({name:'DupleraSupplierIssuance',version:'1',chainId,verifyingContract:address});
const address=z.string().refine(v=>{try{getAddress(v);return true}catch{return false}});
const hex=z.string().regex(/^0x[\da-fA-F]{64}$/);
export const versionSchema=z.object({issuer:address,receivableId:z.uuid(),version:z.number().int().min(1).max(10000),previousDigest:hex,invoice:invoiceSchema,signature:z.string().regex(/^0x[\da-fA-F]+$/).max(300)});
export type SignedInvoice=z.infer<typeof versionSchema>;
export function invoiceDigest(invoice:unknown){return keccak256(toUtf8Bytes(JSON.stringify(canonicalise(invoice))));}
export function versionPayload(pkg:Omit<SignedInvoice,'signature'>){return {issuer:getAddress(pkg.issuer),receivableId:pkg.receivableId,version:pkg.version,previousDigest:pkg.previousDigest,invoiceDigest:invoiceDigest(pkg.invoice)};}
export function versionDigest(pkg:Omit<SignedInvoice,'signature'>){return keccak256(toUtf8Bytes(JSON.stringify(versionPayload(pkg))));}
export function verifyInvoiceVersion(input:unknown,chainId:number,registry:string){
 const pkg=versionSchema.parse(input),payload=versionPayload(pkg);
 if(getAddress(verifyTypedData(issuanceDomain(chainId,registry),issueTypes,payload,pkg.signature))!==getAddress(pkg.issuer))throw new Error('Invalid supplier invoice signature');
 if(pkg.version===1&&pkg.previousDigest!==ZeroHash)throw new Error('Original invoice cannot reference a predecessor');
 if(pkg.version>1&&pkg.previousDigest===ZeroHash)throw new Error('Amendment must reference its predecessor');
 return {pkg,payload,digest:versionDigest(pkg),identity:identity(pkg.invoice)};
}
export const supplierAuthorizationSchema=z.object({issuer:address,country:z.string().regex(/^[A-Z]{2}$/),identifierType:z.string().min(1).max(160),identifier:z.string().min(1).max(160),active:z.boolean(),revision:z.number().int().positive(),deadline:z.number().int().positive(),signature:z.string().max(300)});
export function supplierMatches(invoice:z.infer<typeof invoiceSchema>,supplier:{country:string;identifier_type:string;identifier:string}){
 return normalise(invoice.supplierCountry)===normalise(supplier.country)&&normalise(invoice.supplierIdentifierType)===normalise(supplier.identifier_type)&&normalise(invoice.supplierIdentifier)===normalise(supplier.identifier);
}
