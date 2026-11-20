import {createHmac} from 'node:crypto';
import {getAddress,verifyTypedData} from 'ethers';
import {canonicalise,normalise} from '../../../packages/domain/src/index';
import {supplierAuthorizationSchema,supplierTypes,issuanceDomain,verifyInvoiceVersion,supplierMatches,versionDigest,versionPayload} from '../../../packages/domain/src/issuance';
import {db,deployment,HttpError} from './server';

export async function authorizeSupplier(input:unknown){
 const a=supplierAuthorizationSchema.parse(input),d=await deployment();
 if(a.deadline<Math.floor(Date.now()/1000)||a.deadline>Math.floor(Date.now()/1000)+3600)throw new HttpError(400,'Supplier authorization must expire within one hour');
 if(getAddress(verifyTypedData(issuanceDomain(d.chainId,d.address),supplierTypes,a,a.signature))!==getAddress(d.admin))throw new HttpError(403,'Administrator signature required');
 const previous=(await db.query('SELECT revision FROM suppliers WHERE wallet=$1',[a.issuer.toLowerCase()])).rows[0];
 if(a.revision!==Number(previous?.revision??0)+1)throw new HttpError(409,'Supplier authorization revision must advance by one');
 const updated=await db.query(`INSERT INTO suppliers(wallet,country,identifier_type,identifier,active,revision,enrollment) VALUES($1,$2,$3,$4,$5,$6,$7)
 ON CONFLICT(wallet) DO UPDATE SET active=EXCLUDED.active,revision=EXCLUDED.revision,enrollment=EXCLUDED.enrollment
 WHERE suppliers.revision=EXCLUDED.revision-1 AND suppliers.country=EXCLUDED.country AND suppliers.identifier_type=EXCLUDED.identifier_type AND suppliers.identifier=EXCLUDED.identifier RETURNING wallet`,[a.issuer.toLowerCase(),a.country,normalise(a.identifierType),normalise(a.identifier),a.active,a.revision,a]);
 if(!updated.rowCount)throw new HttpError(409,'Supplier revision must advance by one and identity cannot change');
 return {wallet:a.issuer,active:a.active,revision:a.revision};
}
export async function registerVersion(input:unknown){
 const d=await deployment();let verified;try{verified=verifyInvoiceVersion(input,d.chainId,d.address)}catch{throw new HttpError(400,'Invalid supplier signature or version package')}
 const {pkg,digest}=verified,client=await db.connect();
 try{
  await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[pkg.issuer.toLowerCase()+pkg.receivableId]);
  const supplier=(await client.query('SELECT * FROM suppliers WHERE wallet=$1 FOR SHARE',[pkg.issuer.toLowerCase()])).rows[0];
  if(!supplier?.active||!supplierMatches(pkg.invoice,supplier))throw new HttpError(403,'Supplier is not registered for this invoice identity');
  const existing=(await client.query('SELECT digest FROM invoice_versions WHERE digest=$1',[digest])).rows[0];if(existing){await client.query('COMMIT');return {digest,reused:true}}
  const head=(await client.query('SELECT * FROM invoice_versions WHERE issuer=$1 AND receivable_id=$2 ORDER BY version DESC LIMIT 1',[pkg.issuer.toLowerCase(),pkg.receivableId])).rows[0];
  if(pkg.version!==(head?head.version+1:1)||pkg.previousDigest!==(head?.digest??'0x'+'0'.repeat(64)))throw new HttpError(409,'Amendment must extend the current head; forks and skipped versions are rejected');
  // Original invoice identity anchors every amendment, including altered numbers/namespaces.
  const genesis=head?.genesis_identity??verified.identity;
  await client.query('INSERT INTO invoice_versions(digest,issuer,receivable_id,version,previous_digest,genesis_identity,package) VALUES($1,$2,$3,$4,$5,$6,$7)',[digest,pkg.issuer.toLowerCase(),pkg.receivableId,pkg.version,pkg.previousDigest,genesis,pkg]);
  await client.query('COMMIT');return {digest,version:pkg.version};
 }catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
}
export async function checkedIssuance(digest:string,invoice:unknown){
 const row=(await db.query('SELECT v.*,s.active FROM invoice_versions v JOIN suppliers s ON s.wallet=v.issuer WHERE v.digest=$1',[digest])).rows[0];
 if(!row?.active)throw new HttpError(409,'Issuer is inactive or signed version is not registered');
 const d=await deployment(),verified=verifyInvoiceVersion(row.package,d.chainId,d.address);
 if(verified.digest!==digest||JSON.stringify(canonicalise(invoice))!==JSON.stringify(canonicalise(row.package.invoice)))throw new HttpError(409,'Submitted fields do not match the supplier-signed invoice');
 const latest=(await db.query('SELECT digest FROM invoice_versions WHERE issuer=$1 AND receivable_id=$2 ORDER BY version DESC LIMIT 1',[row.issuer,row.receivable_id])).rows[0];
 if(latest.digest!==digest)throw new HttpError(409,'Invoice version is superseded. Use the current supplier amendment');
 return {row,token:'0x'+createHmac('sha256',process.env.REGISTRY_SECRET!).update(row.genesis_identity).digest('hex')};
}
export async function lineage(digest:string){
 const row=(await db.query('SELECT issuer,receivable_id FROM invoice_versions WHERE digest=$1',[digest])).rows[0];if(!row)throw new HttpError(404,'Invoice version not found');
 const d=await deployment();
 return (await db.query('SELECT digest,version,previous_digest,created_at,package FROM invoice_versions WHERE issuer=$1 AND receivable_id=$2 ORDER BY version',[row.issuer,row.receivable_id])).rows.map(v=>{
  let signatureValid=false;try{signatureValid=verifyInvoiceVersion(v.package,d.chainId,d.address).digest===v.digest}catch{}
  const {package:pkg,...metadata}=v;return {...metadata,signatureValid,signedEnvelope:versionPayload(pkg),signature:pkg.signature};
 });
}
export async function historicalIssuanceToken(digest:string,invoice:unknown){
 const row=(await db.query('SELECT package,genesis_identity FROM invoice_versions WHERE digest=$1',[digest])).rows[0];
 if(!row)throw new HttpError(404,'Signed version not found');
 const d=await deployment(),verified=verifyInvoiceVersion(row.package,d.chainId,d.address);
 if(verified.digest!==digest||JSON.stringify(canonicalise(invoice))!==JSON.stringify(canonicalise(row.package.invoice)))throw new HttpError(409,'Signed invoice metadata mismatch');
 return '0x'+createHmac('sha256',process.env.REGISTRY_SECRET!).update(row.genesis_identity).digest('hex');
}
