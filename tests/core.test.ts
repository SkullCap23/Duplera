import {test} from "node:test";
import assert from "node:assert/strict";
import {matchingToken,identity,invoiceSchema} from "@duplera/domain";
import {buildEvidence,disclose,verifyDisclosure,storedEvidenceMatches} from "@duplera/evidence";
import {compare,isCandidate} from "@duplera/matching";
export const invoice={supplierCountry:"IN",supplierIdentifierType:"SYNTHETIC_TAX_ID",supplierIdentifier:"SYN-SUP-001",supplierName:"Aruna Textiles",buyerIdentifier:"SYN-BUY-021",buyerName:"Northstar Imports",invoiceNumberNamespace:"FY2026",invoiceNumber:"INV-2026-0042",invoiceDate:"2026-10-20",currency:"INR",amountMinor:"24850000",description:"Cotton fabric 500 rolls"};
const secret="synthetic-test-key-32-bytes-minimum";
test("identity ignores amount, buyer, layout and case but preserves punctuation and leading zeros",()=>{
  const token=matchingToken(invoice,secret);
  assert.equal(token,matchingToken({...invoice,amountMinor:"999",buyerName:"CHANGED",supplierIdentifier:" syn-sup-001 ",invoiceNumber:"inv-2026-0042"},secret));
  assert.notEqual(token,matchingToken({...invoice,invoiceNumber:"INV20260042"},secret));
  assert.notEqual(token,matchingToken({...invoice,invoiceNumber:"INV-2026-42"},secret));
  assert.notEqual(token,matchingToken({...invoice,invoiceNumberNamespace:"FY2027"},secret));
});
test("identity encoding separates fields and rejects missing identifiers and invalid money",()=>{
  assert.notEqual(identity({...invoice,supplierIdentifier:"AB",invoiceNumberNamespace:"C"}),identity({...invoice,supplierIdentifier:"A",invoiceNumberNamespace:"BC"}));
  assert.throws(()=>identity({...invoice,supplierIdentifier:""}));
  assert.throws(()=>invoiceSchema.parse({...invoice,amountMinor:"1.25"}));
  assert.throws(()=>invoiceSchema.parse({...invoice,invoiceDate:"2026-02-30"}));
});
test("salted evidence validates selected values and detects value, salt, context and path tampering",()=>{
  const a=buildEvidence(invoice,"a".repeat(64)),b=buildEvidence(invoice,"a".repeat(64));
  assert.equal(storedEvidenceMatches(invoice,'a'.repeat(64),a,a.root,a.context),true);
  assert.equal(storedEvidenceMatches({...invoice,amountMinor:'999'},'a'.repeat(64),a,a.root,a.context),false);
  assert.notEqual(a.root,b.root);
  const entries=disclose(a.tree,["invoiceNumber","amountMinor"]);
  assert.equal(entries.length,2);assert.ok(verifyDisclosure(a.root,a.context,1,entries));
  for(const index of [1,2,3,4]){const changed=structuredClone(entries);changed[0].value[index]="TAMPERED";assert.equal(verifyDisclosure(a.root,a.context,1,changed),false);}
  assert.equal(verifyDisclosure(b.root,a.context,1,entries),false);
  assert.equal(verifyDisclosure(a.root,b.context,1,entries),false);
  assert.equal(verifyDisclosure(a.root,a.context,2,entries),false);
  assert.equal(verifyDisclosure(a.root,a.context,1,[]),false);
});
test("candidate retrieval includes altered suppliers and similarity explains invoice-number changes",()=>{
  const altered={...invoice,supplierIdentifier:"SYN-SUP-999",invoiceNumber:"INV-2026-0043"};
  assert.ok(isCandidate(invoice,altered));
  const result=compare(invoice,altered);assert.ok(result.score>=0.70);
  assert.equal(result.signals.find(s=>s.name==="supplier identifier")?.value,0);
  assert.equal(compare(invoice,invoice).score,1);
});
