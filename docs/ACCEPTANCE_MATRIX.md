# Specification acceptance evidence

This matrix maps implemented behaviour to reproducible evidence. It does not convert synthetic tests into production guarantees. The machine-readable acceptance run is recorded in `docs/results/acceptance.json`; a partial run is labelled incomplete and stops on the first failed command.

| Requirement | Implemented mechanism | Evidence |
|---|---|---|
| Direct calls cannot create conflicting exact claims | Atomic effective-state check and token pointer | Contract adversarial racing/direct-call scenarios |
| Lenders sign their own mutations | Injected wallet UI; owner/caller checks; API never sends a lender transaction | Browser workflow, copied-approval and wrong-owner tests |
| Mandatory analysis approvals | EIP-712 domain, configured signer, caller/context/schema/deadline/nonce checks | Modified approval, cross-domain replay and consumed-nonce tests |
| Full lifecycle, expiry replacement and history | Immutable per-cycle claims; atomic expiry; explicit owner release | Contract lifecycle and SQL reference tests |
| Revoked lenders retain cleanup | Reserve/confirm require live membership; cancel/release use ownership | Revocation tests |
| Exact-file, identity and altered-invoice analysis | SHA-256, structured HMAC identity, candidate union and explained scores | Shared tests and family/entity-held-out results |
| User confirmation of extracted fields | Browser text extraction and explicit confirmation | Chrome PDF workflow and extraction tests |
| Small private payloads, no PDF retention | Browser-only original bytes; bounded JSON and submission API | Request-size tests, route implementation |
| Private ownership and attributed review | Signed sessions, owner predicates, recorded review dispositions | Cross-lender API denial and session/replay tests |
| Selected committed evidence is verifiable | Salted typed leaves, context, live root and canonical inclusion | Tampered value/proof/block/transaction tests; independent CLI |
| Database metadata cannot redefine a financed claim | Live contract state and metadata/commitment comparison | Corrupted amount returns inconsistent metadata while FINANCED remains authoritative |
| Recoverable event projection | Checkpoints, overlap, canonical hashes and transactional replay | Deleted/repeated/corrupted event and snapshot/revert test |
| Pending/failed/reorganised transactions are distinct | Durable transaction journal and receipt reconciliation | Miner-off, revert, dropped-transaction and reorganisation integration cases |
| Fair database alternative | Equivalent approvals, membership, nonce consumption, active uniqueness, lifecycle and signed receipts | SQL adversarial tests and measured SQL results |
| Three synthetic lenders and investigator | Seeded directory with live role reads; owner-exported selected packages; read-only verification | Institutions API and investigator policy |
| Reproducible no-fee local setup | Pinned dependencies, portable PostgreSQL, local EVM, setup doctor | README, doctor, build and acceptance sequence |
| Public-testnet fallback boundary | Prepared separate accounts, RPC preflight, Amoy-only resumable deployment | Preflight found zero administrator balance; no public transaction claimed |
| Defensible evaluation | Grouped splits, fixed threshold, relationship labels, candidate recall, negative sampling and reported failures | Dataset manifest, detection JSON files and measured report |
| Course outcomes and documentation | Architecture, threat model, technical report, literature access notes and demo script | docs/COURSE_MAPPING.md and linked documents |

The remaining external/final-submission work is explicit: no-purchase Amoy funding/eligibility, optional hosted accounts, full literature coverage, team-specific academic formatting/slides and a narrated recording. OCR, real payments and production KYC/authenticity remain outside the stated core scope.
