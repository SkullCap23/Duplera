import {readFile,writeFile} from 'node:fs/promises';
const load=async(file:string)=>JSON.parse(await readFile('docs/results/'+file,'utf8'));
const family=await load('detection.json'),entity=await load('detection-entity.json'),sql=await load('postgres.json'),evm=await load('local-evm.json');
const pct=(v:number)=>(100*v).toFixed(2)+'%',num=(v:number)=>v.toFixed(2);
const rows=[family,entity].flatMap(r=>Object.entries(r.methods).map(([name,m]:[string,any])=>`| ${r.split} | ${name} | ${m.tp} | ${m.fn} | ${m.fp} | ${m.tn} | ${pct(m.recall)} | ${pct(m.precision)} |`));
const latency=['reserve','confirm','release'].map(action=>`| ${action} | ${num(sql.operations[action].medianMs)} | ${num(sql.operations[action].p95Ms)} | ${num(evm.operations[action].medianMs)} | ${num(evm.operations[action].p95Ms)} | ${evm.operations[action].medianGas} |`);
await writeFile('docs/results/VALIDATION.md',`# Validation record

Updated from machine-readable results on ${new Date().toISOString()}. Windows x64, Node 22.16.0, Solidity 0.8.38, optimiser 200 runs, EVM Paris, local chain 31337, PostgreSQL 17.11.

## Executed checks

* Strict TypeScript, shared identity/evidence/extraction tests, and the Next.js production build.
* Nine adversarial smart-contract scenarios: roles, signatures, field/domain tampering, concurrent exact claims, owner transitions, permanent financing, nonce reuse, expiry and revoked-lender cleanup.
* PostgreSQL reference tests: approved membership, signed context-bound approvals, nonce consumption, concurrent exclusivity, signed receipts, expiry and cleanup.
* Projection fault injection: repeated, deleted and corrupted events, plus an actual Hardhat snapshot/revert that removes orphaned history.
* Private API and Chrome workflows: login/session/logout, origin enforcement, owner isolation, repeat-safe submission/approval requests, stale analysis, request limits, PDF extraction, wallet financing, saved workspace reload, live evidence, pending/failed/dropped/reorganised transaction recovery.
* An independent CLI verifies package inclusion and disclosures directly through RPC, without the app API or database.

## Detection benchmark

1,000 original families; nine distinct PDF variants per family plus exact reuse of the original file. The held-out and entity-held-out groups each contain ${family.families} families. The separate entity group excludes its original suppliers and buyers from the other groups. Related versions remain grouped by family. Threshold ${family.threshold} was fixed in source before evaluation; results were not used to retune it.

| Split | Method | TP | FN | FP | TN | Recall | Precision |
|---|---|---:|---:|---:|---:|---:|---:|
${rows.join('\n')}

Relationship detection is distinct from financing policy: legitimate amendments are positives for the same underlying invoice; recurring invoices are distinct-invoice negatives. Neither establishes fraud. The structured heuristic deliberately retains its false alerts on recurring lookalikes. All multiple-change positives remain missed. Candidate recall is ${pct(family.candidateRecall)} for the family split and ${pct(entity.candidateRecall)} for the entity split. Negative pairs are deterministically sampled, not exhaustive.

The evaluator reads fields from PDFs using the same extractor as the browser. The manifest supplies relationship labels and split auditing only. Original data are synthetic; a small attributed UN Comtrade aggregate sample inspires selected commodity descriptions, never counterparties, invoice prices or fraud labels.

PDF extraction median/p95 was ${num(family.extractionMs.median)}/${num(family.extractionMs.p95)} ms on the family split and ${num(entity.extractionMs.median)}/${num(entity.extractionMs.p95)} ms on the entity split. These are local observations and may include concurrent-process effects; they do not establish real invoice accuracy or throughput.

## Local lifecycle measurements

SQL used ${sql.samples} cycles, EVM used ${evm.samples}. SQL reserve includes approval verification and receipt signing. EVM time covers local JSON-RPC submission, gas estimation and auto-mined inclusion. These different paths are described separately, not treated as equivalent network finality or evidence of one platform's superiority.

| Operation | SQL median ms | SQL p95 ms | Local EVM median ms | Local EVM p95 ms | EVM median gas |
|---|---:|---:|---:|---:|---:|
${latency.join('\n')}

SQL audit and signed receipts improve accountability but remain under the database operator. The baseline is not deliberately unprotected. Local EVM does not measure public consensus overhead. Gas is not a monetary cost estimate. No Amoy performance has been measured.

## Reproduce

Run npm run seed -- 1000, npm run evaluate, then set EVALUATION_SPLIT=entity-held-out and evaluate again. Run npm run benchmark:baseline, npm run benchmark:contracts, and npm run report:results. Both benchmarks use separate synthetic identities/deployments. Run tests against local services only; fault tests manipulate the local chain clock/miner.
`);
console.log('Validation report generated from actual result files.');
