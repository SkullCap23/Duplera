# Course outcome evidence

| Outcome | Implementation and demonstration | Evidence |
|---|---|---|
| CO1: Understand cryptocurrency, blockchain and DLT | Wallet keys sign transactions; hashes distinguish files, tokens and commitments; compare local execution with optional public testnet consensus | Contract events/receipts, EIP-712 domain tests, architecture diagram; no project cryptocurrency is issued |
| CO2: Analyse financial applications and impact | Cross-lender shared invoice claims, altered-reuse review, confidential private metadata and neutral SQL comparison | Demo scenarios, authenticated SQL reference, measured local lifecycle results and stated coverage limits |
| CO3: Evaluate security | Roles, owner controls, nonce consumption, copied approvals, chain/contract replay, expiry, revoked lenders, proof tampering and reorganisation | Contract, baseline, projection and API/browser tests; threat model |
| CO4: Design and analyse blockchain impact | Contract is authoritative; metadata and detection remain off-chain; independent selective verification and comparative experiments | Working lender/investigator flow, family/entity-held-out tables, gas/latency measurements and limitations |

Unit I is demonstrated through keys, signatures, blocks, transaction ordering and network assumptions. Unit II is represented by trade finance and the governance comparison with a neutral database. Unit III is demonstrated by contract design, deployment and reconciliation. The prototype does not implement validators, mining, Bitcoin BIPs or SegWit. Local Hardhat results are not public-network throughput results.
