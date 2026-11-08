# Implementation status

The local core is implemented, with persistence, recovery, evaluation and a tested SQL reference. The specification remains authoritative. Public deployment and the final academic submission package have separate completion conditions below.

## Implemented

* npm workspaces, pinned dependencies, lockfile, local setup and environment template.
* Non-upgradeable contract with membership, signed analysis approvals, nonce consumption, exclusive reservation, confirmation, cancellation, atomic expiry replacement, release and immutable claim history.
* Shared identity normalisation, integer minor-unit money validation, HMAC tokens and deterministic explainable similarity.
* Owner-scoped PostgreSQL submissions, login challenges/sessions, analyses, review dispositions, attestations and private evidence.
* Browser PDF extraction and field confirmation, injected lender wallet transactions, claim lookup and independent evidence verifier.
* Salted StandardMerkleTree fields, selected disclosure export, live-root verification and reservation inclusion references.
* Seeded synthetic PDF families, three layouts, exact/layout/amount/number/supplier/multiple-change cases, family-held-out evaluation and sampled distinct-invoice negatives.
* Bounded event replay and a small transactional PostgreSQL lifecycle adapter.
* Shared-code tests, adversarial contract tests, production build and API/browser integration suite.
* Restorable lender sessions, saved submissions and transaction history; selected evidence can be exported after a reload.
* Repeat-safe, owner-scoped submission and attestation requests, including concurrent approval retries and mismatched-key rejection.
* Transaction journal with sender/destination/network/commitment validation and pending, included, confirmed, failed, unknown and reorganised states. Local browser journal recovers a hash when server persistence fails.
* Projection checkpoints, overlapping range replay, missing/corrupted event recovery and actual snapshot/revert reorganisation tests.
* SQL approval verification, membership and nonce enforcement, concurrency tests, owner transitions, signed receipts and lifecycle benchmarks.
* Human-readable invoice labels shared by browser/evaluator; missing or conflicting values require confirmation. Explicit date/amendment/recurring cases and supplier/buyer-disjoint entity-held-out evaluation.
* Cached, attributed aggregate UN Comtrade context, retrieval metadata and checksum; only selected descriptions use it. Entities, prices and relationship labels remain synthetic.
* Independent RPC/CLI receipt verifier with canonical reservation inclusion checks; documented owner-controlled investigator disclosure policy.
* Amoy-only deployment preflight, separate account validation, pending-deployment records and configuration mismatch checks.
* Course outcome mapping, reproducible measured-results report and a local demonstration script.
* Owner-only claim-details API, live synthetic lender directory, metadata-versus-commitment checks and a visible discrepancy alert.
* Shared web/CLI verification of canonical reservation inclusion; forged transaction/block references fail even when field proofs are otherwise valid.
* Database binding to chain, contract, signer and HMAC fingerprint; idempotent local setup preserves the current deployment and keys.
* Prepared dedicated Amoy accounts and a successful read-only RPC preflight. The administrator currently has zero test POL.
* Deployment interruption/restart tests prove the same signed deployment hash is recovered; membership stages are also journalled before broadcast.
* Local readiness doctor, a single acceptance command with recorded exit codes, technical report and source-access-aware literature notes.
* Idle/advanced local-clock regression coverage: approvals use the raw pending header timestamp, including headers with a null block number.

## External or final-submission work

* Amoy accounts/RPC are prepared and the endpoint returned chain 80002. Deployment has not been executed because the prepared administrator has zero test POL. The preflight submits nothing. Actual no-purchase faucet eligibility and sufficient administrator/lender balances remain external requirements; see AMOY.md for the public funding address.
* Optional hosting requires the team's chosen accounts and current allowance checks. The tested local deployment remains the fallback.
* A technical report and bounded literature review notes are written. A complete academic literature chapter still requires reviewing the remaining papers; blocked full texts are explicitly recorded. A narrated local walkthrough is included under docs/demo. The team should review institution-specific report formatting and slides before final submission.
* General unlabelled invoice parsing, OCR, cryptographic issuer authentication and production governance remain outside the core prototype. Current extraction supports the three synthetic layouts plus a bounded human-label alias set, with manual confirmation.

## Further validation opportunities

Long-running outage/load tests, larger and genuinely independent invoice populations, broader reorganisation depths and external contract review would strengthen this prototype. The current tests cover local fault scenarios rather than claiming production reliability.

## Known limits

The signer/backend sees private fields and can bind incorrect identifiers. The contract enforces exclusivity only for the recognised token inside its deployment. Altering enough identity signals can evade detection. Public observers see token equality, lender addresses, timing and volume. Salted proofs establish committed values, not supplier authenticity or hidden-field matching. Approved lenders can repeatedly reserve; the prototype has no robust anti-squatting governance. No real funds, OCR, loan servicing or legal priority are implemented.

The literature PDF is a bibliography, not a source of experimental results. Its listed papers must be read before attributing technical findings to them. No original-novelty or commercial-superiority claim is made.
