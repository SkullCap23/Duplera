import { z } from "zod";
import { createHmac } from "node:crypto";

export const SCHEMA_VERSION = 1;
const text = z.string().trim().min(1).max(160);
export const invoiceSchema = z.object({
  supplierCountry: z.string().regex(/^[A-Za-z]{2}$/), supplierIdentifierType: text,
  supplierIdentifier: text, supplierName: text, buyerIdentifier: text, buyerName: text,
  invoiceNumberNamespace: text, invoiceNumber: text,
  invoiceDate: z.iso.date(), currency: z.string().regex(/^[A-Za-z]{3}$/),
  amountMinor: z.string().regex(/^[1-9]\d{0,17}$/), description: z.string().trim().min(1).max(2000),
});
export type Invoice = z.infer<typeof invoiceSchema>;
export const normalise = (s: string) => s.normalize("NFKC").trim().replace(/\s+/gu, " ").toUpperCase();
export function canonicalise(input: unknown): Invoice {
  const v = invoiceSchema.parse(input);
  return Object.fromEntries(Object.entries(v).map(([k, value]) => [k, normalise(value)])) as Invoice;
}
export function identity(input: unknown): string {
  const v = canonicalise(input);
  return JSON.stringify([SCHEMA_VERSION, v.supplierCountry, v.supplierIdentifierType,
    v.supplierIdentifier, v.invoiceNumberNamespace, v.invoiceNumber]);
}
export function matchingToken(input: unknown, secret: string): string {
  if (Buffer.byteLength(secret) < 32) throw new Error("Registry secret must contain at least 32 bytes");
  return "0x" + createHmac("sha256", secret).update(identity(input)).digest("hex");
}
export const attestationTypes = { Attestation: [
  {name:"schemaVersion",type:"uint32"}, {name:"matchingToken",type:"bytes32"},
  {name:"evidenceRoot",type:"bytes32"}, {name:"lenderAddress",type:"address"},
  {name:"evidenceContext",type:"bytes32"}, {name:"analysisId",type:"bytes32"},
  {name:"attestationNonce",type:"bytes32"}, {name:"validUntil",type:"uint64"},
] };
export const registryDomain = (chainId: number, verifyingContract: string) => ({ name: "DupleraRegistry", version: "1", chainId, verifyingContract });
