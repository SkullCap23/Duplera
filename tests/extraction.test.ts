import {test} from 'node:test';import assert from 'node:assert/strict';
import {extractInvoiceFields} from '../packages/domain/src/extraction';
test('extracts human invoice labels without inventing identifiers or ambiguous money',()=>{
 const result=extractInvoiceFields('Supplier ID: SYN-001\nInvoice no.: INV-0042\nInvoice date: 2026-10-22\nTotal: 1,234.50\nCurrency: INR');
 assert.equal(result.fields.supplierIdentifier,'SYN-001');assert.equal(result.fields.invoiceNumber,'INV-0042');assert.equal(result.fields.amountMinor,'');assert.equal(result.fields.invoiceNumberNamespace,'');assert.ok(result.warnings.length);
});
test('conflicting repeated labels require manual confirmation',()=>{const r=extractInvoiceFields('Invoice number: A\nInvoice number: B');assert.equal(r.fields.invoiceNumber,'');assert.ok(r.warnings.some(w=>w.includes('Conflicting')))});
