import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { randomBytes } from "node:crypto";
import { canonicalise, SCHEMA_VERSION } from "@duplera/domain";
export const LEAF_TYPES=["uint32","bytes32","string","string","bytes32"];
export function buildEvidence(input: unknown, digest: string) {
  const context="0x"+randomBytes(32).toString("hex");
  const fields={...canonicalise(input),pdfDigest:digest};
  const tree=StandardMerkleTree.of(Object.entries(fields).map(([path,value])=>[
    SCHEMA_VERSION,context,path,value,"0x"+randomBytes(32).toString("hex")]),LEAF_TYPES);
  return {context,root:tree.root,tree:tree.dump()};
}
export function disclose(treeDump: ReturnType<ReturnType<typeof StandardMerkleTree.of>["dump"]>, paths: string[]) {
  const tree=StandardMerkleTree.load(treeDump);
  return [...tree.entries()].filter(([,v])=>paths.includes(String(v[2]))).map(([i,value])=>({value,proof:tree.getProof(i)}));
}
export function verifyDisclosure(root: string, context: string, schema: number, entries: {value: unknown[];proof:string[]}[]) {
  try {
    return entries.length>0 && new Set(entries.map(e=>e.value[2])).size===entries.length && entries.every(e=>
      e.value.length===5 && Number(e.value[0])===schema && e.value[1]===context && StandardMerkleTree.verify(root,LEAF_TYPES,e.value,e.proof));
  } catch { return false; }
}
export function storedEvidenceMatches(input:unknown,digest:string,evidence:ReturnType<typeof buildEvidence>,root:string,context:string){
 try{
  const expected:Record<string,string>={...canonicalise(input),pdfDigest:digest};
  const tree=StandardMerkleTree.load(evidence.tree),values=[...tree.entries()].map(([,value])=>value);
  return tree.root===root&&evidence.root===root&&evidence.context===context&&values.length===Object.keys(expected).length&&new Set(values.map(v=>v[2])).size===values.length&&values.every(v=>v[0]===SCHEMA_VERSION&&v[1]===context&&typeof v[2]==='string'&&expected[v[2]]===v[3]);
 }catch{return false;}
}
