# Validation record

Updated from machine-readable results on 2026-11-03T17:11:27.308Z. Windows x64, Node 22.16.0, Solidity 0.8.38, optimiser 200 runs, EVM Paris, local chain 31337, PostgreSQL 17.11.

## Executed checks

* Strict TypeScript, shared identity/evidence/extraction tests, and the Next.js production build.
* Nine adversarial smart-contract scenarios: roles, signatures, field/domain tampering, concurrent exact claims, owner transitions, permanent financing, nonce reuse, expiry and revoked-lender cleanup.
* PostgreSQL reference tests: approved membership, signed context-bound approvals, nonce consumption, concurrent exclusivity, signed receipts, expiry and cleanup.
* Projection fault injection: repeated, deleted and corrupted events, plus an actual Hardhat snapshot/revert that removes orphaned history.
* Private API and Chrome workflows: login/session/logout, origin enforcement, owner isolation, repeat-safe submission/approval requests, stale analysis, request limits, PDF extraction, wallet financing, saved workspace reload, live evidence, pending/failed/dropped/reorganised transaction recovery.
* An independent CLI verifies package inclusion and disclosures directly through RPC, without the app API or database.

## Detection benchmark

1,000 original families; nine distinct PDF variants per family plus exact reuse of the original file. The held-out and entity-held-out groups each contain 100 families. The separate entity group excludes its original suppliers and buyers from the other groups. Related versions remain grouped by family. Threshold 0.78 was fixed in source before evaluation; results were not used to retune it.

| Split | Method | TP | FN | FP | TN | Recall | Precision |
|---|---|---:|---:|---:|---:|---:|---:|
| held-out | raw | 100 | 700 | 0 | 1045 | 12.50% | 100.00% |
| held-out | identity | 500 | 300 | 0 | 1045 | 62.50% | 100.00% |
| held-out | structured | 700 | 100 | 102 | 943 | 87.50% | 87.28% |
| entity-held-out | raw | 100 | 700 | 0 | 1045 | 12.50% | 100.00% |
| entity-held-out | identity | 500 | 300 | 0 | 1045 | 62.50% | 100.00% |
| entity-held-out | structured | 700 | 100 | 101 | 944 | 87.50% | 87.39% |

Relationship detection is distinct from financing policy: legitimate amendments are positives for the same underlying invoice; recurring invoices are distinct-invoice negatives. Neither establishes fraud. The structured heuristic deliberately retains its false alerts on recurring lookalikes. All multiple-change positives remain missed. Candidate recall is 87.50% for the family split and 87.50% for the entity split. Negative pairs are deterministically sampled, not exhaustive.

The evaluator reads fields from PDFs using the same extractor as the browser. The manifest supplies relationship labels and split auditing only. Original data are synthetic; a small attributed UN Comtrade aggregate sample inspires selected commodity descriptions, never counterparties, invoice prices or fraud labels.

PDF extraction median/p95 was 4.30/7.16 ms on the family split and 3.97/6.60 ms on the entity split. These are local observations and may include concurrent-process effects; they do not establish real invoice accuracy or throughput.

## Local lifecycle measurements

SQL used 50 cycles, EVM used 20. SQL reserve includes approval verification and receipt signing. EVM time covers local JSON-RPC submission, gas estimation and auto-mined inclusion. These different paths are described separately, not treated as equivalent network finality or evidence of one platform's superiority.

| Operation | SQL median ms | SQL p95 ms | Local EVM median ms | Local EVM p95 ms | EVM median gas |
|---|---:|---:|---:|---:|---:|
| reserve | 24.35 | 30.49 | 77.27 | 105.99 | 223968 |
| confirm | 5.44 | 6.47 | 77.85 | 89.12 | 33042 |
| release | 4.46 | 5.96 | 78.48 | 93.67 | 30213 |

SQL audit and signed receipts improve accountability but remain under the database operator. The baseline is not deliberately unprotected. Local EVM does not measure public consensus overhead. Gas is not a monetary cost estimate. No Amoy performance has been measured.

## Reproduce

Run npm run seed -- 1000, npm run evaluate, then set EVALUATION_SPLIT=entity-held-out and evaluate again. Run npm run benchmark:baseline, npm run benchmark:contracts, and npm run report:results. Both benchmarks use separate synthetic identities/deployments. Run tests against local services only; fault tests manipulate the local chain clock/miner.
