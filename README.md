# Duplera

A local blockchain registry for duplicate invoice financing detection and verifiable financing claims. Built from [PROJECT_SPECIFICATION.md](PROJECT_SPECIFICATION.md) for Blockchain & its Applications.

The EVM contract governs claim state. PostgreSQL stores private submissions and analysis. A shared HMAC identity detects reformatted invoices; explainable similarity flags possible altered reuse; salted Merkle proofs let a reviewer check selected fields against the live contract.

This is a synthetic-data university prototype. A match does not establish fraud; a proof does not establish trade authenticity, disbursement, ownership, or legal priority.

## Run locally

Use Node **22.16.0** (or a compatible newer supported even-numbered LTS), npm, and Chrome for browser tests. No purchased tokens or hosted accounts are required.

```powershell
npm ci
npm run compile
```

Keep these services running in separate terminals in this directory:

```powershell
# Terminal 1: local EVM, chain ID 31337
npm run chain
```

```powershell
# Terminal 2: portable PostgreSQL 17, localhost:5432
npm run db:local
```

Docker is an alternative to the portable database: `docker compose up -d`. Run only one database on port 5432. Portable PostgreSQL stores development data in ignored `.local/postgres`; its npm wrapper has a beta version label. Do not use these default local credentials for hosting.

```powershell
# Terminal 3, after the two services are ready
npm run db:setup
npm run deploy:local
npm run db:setup # bind the private database and seed synthetic lender identities
npm run seed -- 20
npm run dev
```

Open the localhost URL printed by Next.js. The default is [localhost:3000](http://localhost:3000). If it selects another port, update `APP_ORIGIN` in `apps/web/.env.local` to that exact origin. In the initial development session port 3000 was occupied, so the app used [localhost:3001](http://localhost:3001).

The first `deploy:local` generates the ignored deployment file and `apps/web/.env.local`. Subsequent runs verify and reuse the existing contract without replacing its keys or origin. Hardhat accounts **1, 2 and 3** are lenders; account **0** is administrator. Configure your test wallet with RPC `http://127.0.0.1:8545` and chain ID `31337`, then import one of those lender keys from the Hardhat terminal. Those accounts and their published keys are exclusively for local development. `npm run doctor` checks the registry, signer, lenders, database binding and configured web origin without printing secrets.

Restarting the local chain loses chain state. Setup refuses to treat an unavailable saved deployment as a live registry. For a deliberate new deployment, create a dedicated database, set its DATABASE_URL, then run `npx tsx scripts/deploy.ts --new` and `npm run db:setup`. Previous local metadata/environment are backed up under ignored `.local/deployment-backups`. Database binding prevents silently reusing private records with another contract, signer or HMAC secret. There is no automatic migration between registries. `.env.example` documents configuration names; never commit actual secrets.

## Demonstration

1. Connect an approved lender wallet and sign the one-time login challenge.
2. Choose `data/synthetic/family-00000-base.pdf`. The browser extracts labelled text and computes SHA-256 locally. Check and confirm the fields.
3. Analyse and reserve using the lender wallet, then open the claim explorer and confirm financing.
4. Sign in as another lender and submit the same PDF, its `layout` variant or its `amount` variant. An active exact claim blocks the reservation.
5. Try the `number` variant. Review the explained similarity alert. This heuristic can miss altered identities; the contract cannot recognise semantic duplicates by itself.
6. Export selected fields from the first submission and paste the package into the evidence verifier. Alter a disclosed value and verify again. Independent verification is also available with `npm run verify:receipt -- path/to/package.json`.
7. Release financing from its original lender. A fresh submission/approval can begin a new cycle while the original claim remains historical.

Reloading restores your signed session and Saved workspace. Open a saved submission or transaction to recover its claim and export evidence. A pending transaction hash is kept in a browser journal until the server can reconcile it; inclusion is checked against canonical chain records. Unknown/dropped transactions are never treated as accepted financing.

Generated layouts use machine and human-readable labels for reproducible extraction. Missing/conflicting fields require confirmation; arbitrary invoice formats require manual entry. Scans and OCR are unsupported. PDFs are capped at 2 MB and ten pages; original PDFs are not uploaded.

## Checks and experiments

```powershell
npm run typecheck
npm test
npm run test:contracts   # requires local EVM; uses a separate test deployment
npm run build
npm run test:e2e         # requires local DB, deployed registry, web app and Chrome
npm run test:baseline    # SQL signature, concurrency, expiry and ownership tests
npm run test:projection  # missing/repeated/corrupt events and local reorganisation
npm run test:deployment  # interrupt/resume without duplicate deployment
npm run replay          # rebuilds bounded event cache from the deployment block
npm run data:comtrade    # one bounded public aggregate-context request; cached for offline use
npm run seed -- 1000
npm run evaluate
$env:EVALUATION_SPLIT='entity-held-out'
npm run evaluate
Remove-Item Env:EVALUATION_SPLIT
npm run benchmark:baseline
npm run benchmark:contracts
npm run report:results
```

Browser tests default to `http://localhost:3001`; set `TEST_BASE_URL` to match the running app and `APP_ORIGIN`. The automated wallet bridge exists only in test code; the actual UI uses an injected wallet. Run contract tests before deploying a fresh demo when a clean chain clock matters: adversarial tests advance local EVM time.

Evaluation extracts source fields from generated PDFs rather than reading ground-truth fields. Family grouping keeps variants in one split; a separate entity-held-out split excludes its original suppliers/buyers from all other groups. Results include recurring-lookalike false positives, legitimate amendments and known multi-change failures. These are synthetic relationship-detection measurements, not fraud adjudication or performance on real bank data. A small attributed UN Comtrade sample provides aggregate context for selected descriptions; prices and counterparties remain invented. See [data provenance](data/reference/README.md).

The dev server uses `.next-dev`; production builds use `.next`, so they can run without overwriting each other's output. Tests manipulate the local miner/clock; avoid concurrent manual transactions during fault tests.

## Investigation and public deployment

See [investigator policy](docs/INVESTIGATOR.md) for owner-controlled selected disclosure and independent RPC verification. See [Amoy setup](docs/AMOY.md) for public-testnet preflight/deployment, account separation and conditional token availability. No Amoy deployment is claimed until an actual transaction record exists.

[Measured results](docs/results/VALIDATION.md) · [Course mapping](docs/COURSE_MAPPING.md) · [Demonstration script](docs/DEMO.md)

`npm run validate` runs the local acceptance sequence and writes `docs/results/acceptance.json`, stopping on the first failure. Start the chain, database and web app, and generate the demo PDFs first. The sequence manipulates the local chain; avoid concurrent manual transactions. It does not contact Amoy or deploy publicly.

[Technical report](docs/TECHNICAL_REPORT.md) · [Literature notes and source-access record](docs/LITERATURE_NOTES.md)

## Repository

| Path | Purpose |
|---|---|
| `apps/web` | Next.js lender UI, claim explorer, public verifier, authenticated API |
| `packages/contracts` | Non-upgradeable registry using OpenZeppelin roles and EIP-712 |
| `packages/domain` | Validated schema, canonical identity, SQL schema and reference adapter |
| `packages/matching` | Candidate retrieval, weighted comparisons and explained scores |
| `packages/evidence` | StandardMerkleTree generation, selective export and verification |
| `scripts` | Compile/deploy, local database, PDF generation, evaluation and event replay |
| `tests` | Shared-code, adversarial contract and API/browser tests |
| `docs` | Architecture, implementation status, threat model and measured results |

See [implementation status](docs/IMPLEMENTATION_STATUS.md) for completed functionality and outstanding specification items. The original specification remains the acceptance reference.
