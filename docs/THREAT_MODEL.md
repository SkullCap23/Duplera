# Threat model

| Threat | Implemented control | Residual issue |
|---|---|---|
| Direct random-token reservation | Mandatory signer approval, caller binding | Signer can attest invented identifiers |
| Copied approval | EIP-712 lender, chain and contract binding | Lender private-key compromise remains fatal for its actions |
| Replay after release | Globally consumed attestation nonce | New valid analyses may permit another cycle |
| Racing exact claims | Atomic EVM check and pointer update | Ordering is chain execution order, not UI submission time |
| Owner or admin interference | Contract role and owner checks; no admin rewrite | Admin controls membership; owner can wrongly release its claim |
| Expired reservation blocks future claims | Effective status and atomic expiry replacement | Approved lenders can repeatedly squat with fresh approvals |
| Cross-lender private reads | Server-side owner predicates and hashed sessions | Backend/database operator still sees private data |
| Public dictionary attack | Server-only registry-scoped HMAC secret | Equality, timing, online probing and secret compromise remain |
| Disclosure modification | Salted typed leaves, context binding, live chain root | Root consistency is not invoice authenticity |
| Stale database projection | Read live contract for decisions | RPC availability and selected network assumptions remain trusted |
| Missing events/reorg | Checkpoints, overlapping replay, canonical hashes and transaction reconciliation; snapshot/revert tests | Long-running public-network reorganisation depths remain unmeasured |
| Database outage | New private workflow/attestations fail closed | Previously loaded contract UI can still submit owner transitions |

Never submit fields, salts, HMAC secrets or analysis keys to chain calldata or events. The compiled contract accepts only opaque commitments and typed approval metadata. Use synthetic data only. The development PostgreSQL credentials and published Hardhat wallets must remain local.
