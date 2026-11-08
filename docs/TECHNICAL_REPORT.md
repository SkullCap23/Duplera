# Duplera: duplicate invoice financing registry

## Abstract

Duplera is a synthetic-data university prototype combining an EVM claim registry, private invoice analysis and selective evidence disclosure. Approved lenders control their own financing lifecycle through wallet-signed transactions. A trusted service normalises invoice identity, searches for possible reuse and signs context-bound reservation approvals. The contract atomically limits effective active claims for a recognised token. Salted Merkle proofs support verification of selected committed values. A PostgreSQL reference and family/entity-held-out experiments examine the boundary between deterministic exclusivity and heuristic relationship detection.

## Problem and scope

Separate lenders may receive copies or modified versions of one invoice. Byte hashing recognises exact copies but changes with formatting or content. Business identifiers may remain stable across formatting changes, while altered identifiers require heuristic review. Participating lenders need common rules for active claims and reviewable evidence of what was submitted.

The scope includes three synthetic lenders, text PDFs, full-invoice exclusivity, reservations, financing declarations, cancellation, expiry and release. It excludes real payments, issuer authentication, legal priority, partial financing, loan servicing and OCR. A relationship alert is not a finding of fraud.

## Prior work and architectural choice

Record-linkage research separates candidate generation from pair comparison and review; Duplera follows that separation and evaluates retrieval misses. Blockchain-choice research motivates stating trust requirements and comparing a central database. Existing invoice-financing blockchain work establishes that a registry alone is not a novel contribution. See [literature notes](LITERATURE_NOTES.md) for inspected material and source-access limits.

The implemented contribution is the integration and evaluated trust boundary, not new cryptography. The public-EVM application has approved writers but does not operate a private consortium chain or its consensus. Independent inspection of accepted rules/history is the blockchain motivation. Confidential comparison does not inherently require blockchain, and the neutral SQL reference correctly handles concurrent exact claims.

## System design

The browser hashes the original PDF and extracts labelled text locally. Users confirm or correct critical fields. The API receives these assertions rather than a retained PDF. A wallet-signed, expiring one-time challenge establishes a short-lived private session. Server operations enforce ownership and limits.

The domain schema uses ISO dates, currency codes and positive integer minor-unit amounts. String normalisation applies NFKC, whitespace collapse and uppercase while preserving meaningful punctuation and leading zeros. A registry-scoped HMAC binds schema, supplier country/type/identifier, number namespace and invoice number. Amount, file bytes, lender and fresh salts are excluded from identity.

Structured analysis compares supplier and buyer identifiers, invoice-number resemblance, dates, amounts, currency and description overlap. The weights/threshold are deterministic heuristics, not calibrated fraud probabilities. Multiple retrieval conditions avoid making exact supplier identity the only route into scoring. A bounded incomplete scan cannot issue an approval.

Every new reservation requires EIP-712 approval bound to schema, token, root, lender, random context, analysis ID, nonce and deadline. Chain ID and registry address bind the signature domain. PostgreSQL and browser state cannot bypass contract execution.

The evidence tree uses OpenZeppelin StandardMerkleTree's typed encoding with independent 256-bit field salts. Root, matching token, file digest and cycle-specific claim ID have separate roles. Neither values nor salts are submitted as public calldata.

## Authoritative lifecycle

RESERVED can become FINANCED before its deadline, CANCELLED by its owner before expiry, or EXPIRED when its deadline is reached. A new reservation can atomically finalise an expired predecessor. FINANCED remains active until its owner RELEASES it. Later cycles receive new IDs and immutable historical evidence. Revocation prevents new reservations/confirmation while retaining owner cleanup.

The main invariants are one effective active claim per recognised token, immutable owner/root/context, owner-only transitions, non-replayable approvals, no automatic financing timeout and replayable lifecycle events. The administrator controls membership but has no privileged rewrite/release operation.

## Evidence and recovery

Owners export selected fields with salts/proofs and canonical reservation references. The web and standalone CLI verifiers check the configured deployment, live claim root, matching reservation event, successful receipt and canonical block hash. The CLI does not use the app API or database. This proves committed-field consistency and inclusion, not authenticity, disbursement or hidden-field matching.

Private metadata can be compared against the immutable commitment through the owner-only claim endpoint. Database bindings reject accidental reuse with another deployment/signer/secret. The transaction journal validates network, destination, sender and submitted commitments; pending, included, confirmed, failed, unknown and reorganised states remain distinct. Event replay uses checkpoints, overlap and canonical hash checks. Confirmation counts are application policies rather than mathematical finality.

## Evaluation

The source dataset contains 1,000 synthetic families, three layouts, exact reuse and layout/amount/date/number/supplier/multiple-change variants, legitimate amendments and distinct recurring invoices. Related variants remain in one split. A separate entity-held-out group excludes its suppliers and buyers from the other groups. The evaluator reads PDF fields instead of taking generator answers.

The latest [measured report](results/VALIDATION.md) contains reproducible counts, extraction timing, SQL lifecycle measurements and local-EVM gas/inclusion observations. In the recorded expanded dataset, structured recall is 87.5% for both held-out groups. Family-split precision is about 87.28%, and entity-split precision about 87.39%. Recurring lookalikes produce false alerts; all multiple-change positives are missed. These are synthetic relationship-detection results, not bank-grade fraud accuracy.

SQL and EVM measurements use different execution paths and sample sizes. They are disclosed separately; neither local timings nor gas establish public-network capacity, monetary savings or one platform's commercial superiority. Selected commodity descriptions use attributed aggregate UN Comtrade context. Counterparties, invoice prices and relationship labels remain invented.

## Security, limitations and completion boundary

Tests cover direct-call signature/role attacks, racing claims, expiry, revocation, SQL replay/concurrency, owner isolation, request limits, stale approvals, altered evidence, database metadata corruption, transaction failures and local reorganisation. Resumable public deployment signs and journals transactions before broadcast; restart reuses their hashes.

The service sees private fields and remains trusted to bind identifiers and alert policy. A compromised signer can approve false semantics. Non-participating finance, unseen identifier relationships, repeated authorised reservations, public equality/timing leakage and compromised lender keys remain limitations. Network/RPC assumptions also remain trusted. The demo is entirely synthetic.

The local application and experiments are reproducible without paid services. Dedicated Amoy accounts and deployment tools are prepared; deployment remains conditional on no-purchase test POL and current provider eligibility. The present preflight found zero administrator balance and submitted no public transaction. Optional hosting, full literature review and the team's final narrated presentation are distinct from the validated local implementation.
