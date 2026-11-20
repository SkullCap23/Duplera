import type {Pool,PoolClient} from 'pg';
import {canonicalise,type Invoice} from './index';
/** Indexable union; a date bucket deliberately over-retrieves number mutations for JS scoring. */
export async function retrieveCandidates(db:Pool|PoolClient,invoice:Invoice,digest:string,excludeId:string,matchingToken:string){
 const v=canonicalise(invoice);
 const result=await db.query(`WITH ids AS (
 SELECT id FROM submissions WHERE pdf_digest=$1
 UNION SELECT id FROM submissions WHERE matching_token=$9
 UNION SELECT id FROM submissions WHERE normalised->>'supplierIdentifier'=$2 AND normalised->>'invoiceDate' BETWEEN $3 AND $4
 UNION SELECT id FROM submissions WHERE normalised->>'buyerIdentifier'=$5 AND normalised->>'currency'=$6 AND (normalised->>'amountMinor')::numeric BETWEEN $7::numeric*0.9 AND $7::numeric/0.9
 UNION SELECT id FROM submissions WHERE normalised->>'invoiceDate' BETWEEN $3 AND $4
 ) SELECT s.id,s.owner,s.normalised,s.pdf_digest,s.matching_token FROM submissions s JOIN ids ON ids.id=s.id WHERE s.id<>$8`,
 [digest,v.supplierIdentifier,new Date(Date.parse(v.invoiceDate)-60*86400000).toISOString().slice(0,10),new Date(Date.parse(v.invoiceDate)+60*86400000).toISOString().slice(0,10),v.buyerIdentifier,v.currency,v.amountMinor,excludeId,matchingToken]);
 return result.rows;
}
