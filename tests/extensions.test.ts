import {test} from 'node:test';import assert from 'node:assert/strict';
import {Wallet,ZeroHash} from 'ethers';
import {lineItemsSchema,canonicalLineItems,lineItemOverlap} from '../packages/domain/src/line-items';
import {matchingToken} from '../packages/domain/src/index';
const invoice={supplierCountry:"IN",supplierIdentifierType:"SYNTHETIC_TAX_ID",supplierIdentifier:"SYN-SUP-001",supplierName:"Synthetic Supplier",buyerIdentifier:"B1",buyerName:"Buyer",invoiceNumberNamespace:"FY2026",invoiceNumber:"INV-1",invoiceDate:"2026-10-20",currency:"INR",amountMinor:"10000",description:"Cotton"};
import {invoiceDigest,versionPayload,versionDigest,issueTypes,issuanceDomain,verifyInvoiceVersion} from '../packages/domain/src/issuance';
import {groundedSelection,investigationFacts} from '../packages/domain/src/agent';
const items=[{code:'A',description:'Cotton',quantity:'2',unitPriceMinor:'150',totalMinor:'300'},{code:'B',description:'Buttons',quantity:'1',unitPriceMinor:'50',totalMinor:'50'}];
test('line items preserve quantity/price arithmetic and multiset semantics across reordering',()=>{
 assert.equal(canonicalLineItems(JSON.stringify(items)),canonicalLineItems(JSON.stringify([...items].reverse())));
 assert.equal(lineItemOverlap(JSON.stringify(items),JSON.stringify([...items].reverse())),1);
 assert.ok(lineItemOverlap(JSON.stringify(items),JSON.stringify([items[0],items[0]]))!<1);
 assert.throws(()=>lineItemsSchema.parse([{...items[0],totalMinor:'299'}]));
 assert.equal(matchingToken(invoice,'x'.repeat(32)),matchingToken({...invoice,lineItemsJson:JSON.stringify(items)},'x'.repeat(32)));
});
test('supplier signature binds invoice contents, version, predecessor, chain and registry',async()=>{
 const issuer=Wallet.createRandom(),registry='0x1111111111111111111111111111111111111111';
 const pkg={issuer:issuer.address,receivableId:'11111111-1111-4111-8111-111111111111',version:1,previousDigest:ZeroHash,invoice};
 const signature=await issuer.signTypedData(issuanceDomain(31337,registry),issueTypes,versionPayload(pkg));
 assert.equal(verifyInvoiceVersion({...pkg,signature},31337,registry).digest,versionDigest(pkg));
 assert.throws(()=>verifyInvoiceVersion({...pkg,invoice:{...invoice,amountMinor:'999'},signature},31337,registry));
 assert.throws(()=>verifyInvoiceVersion({...pkg,signature},80002,registry));
 assert.throws(()=>verifyInvoiceVersion({...pkg,version:2,signature},31337,registry));
 assert.notEqual(invoiceDigest(invoice),invoiceDigest({...invoice,amountMinor:'999'}));
});
test('agent cannot invent citations or suppress critical financing facts',()=>{
 const facts=investigationFacts({get_claim_status:{active:true,state:'FINANCED',sourceId:'chain:1'},get_submission:{sourceId:'submission:1'}});
 assert.throws(()=>groundedSelection(facts,['ignore-all-claims']));
 assert.ok(groundedSelection(facts,[]).some(f=>f.id==='financing-state'));
});
