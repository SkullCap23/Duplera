import solc from "solc";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {resolve} from "node:path";
const source=await readFile("packages/contracts/src/InvoiceRegistry.sol","utf8");
const input={language:"Solidity",sources:{"InvoiceRegistry.sol":{content:source}},settings:{optimizer:{enabled:true,runs:200},evmVersion:"paris",outputSelection:{"*":{"*":["abi","evm.bytecode.object"]}}}};
const output=JSON.parse(solc.compile(JSON.stringify(input),{import:(path:string)=>{try{return {contents:requireSource(path)}}catch{return {error:`Missing import ${path}`}}}}));
function requireSource(path:string){return readFileSync(resolve("node_modules",path),"utf8")}
import {readFileSync} from "node:fs";
const errors=(output.errors??[]).filter((e:{severity:string})=>e.severity==="error");
if(errors.length) throw new Error(JSON.stringify(errors,null,2));
await mkdir("artifacts",{recursive:true});
await writeFile("artifacts/InvoiceRegistry.json",JSON.stringify(output.contracts["InvoiceRegistry.sol"].InvoiceRegistry,null,2));
console.log(`InvoiceRegistry compiled with ${solc.version()}, optimizer 200, EVM paris`);
