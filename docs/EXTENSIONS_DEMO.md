# Extension demonstration

Run `npm run local:start` from the repository root; `npm run local:stop` stops only managed processes and preserves databases/backups. A reset development chain gets a dedicated database. Do not use development wallet keys outside the local chain.

## Supplier signature and amendment lineage

1. In Supplier issuance, expand administrator registration. Select the registry administrator wallet and authorize a synthetic supplier with its wallet, country, identifier type, identifier, active=true, revision=1 and a Unix deadline within an hour. Subsequent authorizations increment revision; active=false revokes new issuance.
2. Fill invoice fields in Lender workspace, switch to the supplier wallet, create a receivable ID and sign version 1. The app registers and downloads its signed JSON package. This is an EIP-712 signature with no gas fee.
3. Import that package, switch to an approved lender, confirm the fields and analyse/reserve/finance. Export the issuerVersionDigest field to prove the signed version was included in the Merkle commitment.
4. Supplier selects Prepare next amendment, changes the invoice amount or number, and signs version 2 using the predecessor digest. Import and analyse it: existing active financing still blocks it because its original receivable identity is retained.
5. Release the first financing and analyse again. The current amendment becomes eligible; superseded versions and forked amendments fail. The investigation report exposes signed lineage envelopes without other lenders' invoice contents.

Supplier registration identifies an administrator-approved key, not a legally verified business. A dishonest issuer can still describe a different receivable; signatures do not prove delivery or prevent all economic double invoicing. Issuance registration and lineage are service-validated; the existing contract enforces the stable financing token and commits the supplier-version digest through the evidence root. The contract does not independently recover supplier signatures.

## Investigation agent

Select your saved submission in Claim explorer, then open Investigation agent. The agent calls owner-scoped tools and produces source-linked findings with a trace and downloadable case brief. Current chain state takes precedence over saved analysis. Invoice text is untrusted data; the model can select verified fact IDs and cannot invent citations or suppress critical financing facts. It cannot submit transactions.

The hosted adapter uses GEMINI_API_KEY and defaults to gemini-3.1-flash-lite, with four bounded model steps, fixed tool permissions and no paid fallback. Use a free-tier project with billing disabled. Quota errors stop the request. The selected invoice fields and permitted evidence are sent to Gemini. AGENT_PROVIDER=ollama uses a loopback Ollama server and an installed model; that adapter needs its own local model smoke test. AGENT_PROVIDER=evidence-only produces an explicitly labelled deterministic evidence report, not an LLM run.

## External MCP client

Create a read-only token in MCP connections. Copy it once into a private environment variable, DUPLERA_MCP_TOKEN. Configure the external client's HTTP MCP endpoint as https://duplera.vercel.app/api/mcp with Authorization: Bearer <token>. A Codex config entry can use:

```toml
[mcp_servers.duplera]
url = "https://duplera.vercel.app/api/mcp"
bearer_token_env_var = "DUPLERA_MCP_TOKEN"
```

Use the client's supported settings/configuration UI; never paste a token in a prompt or commit it. Restart/reconnect the MCP client if needed. Tokens expire after 24 hours, are audience-bound, stored hashed, and can be revoked immediately. Available read-only tools: get_submission, get_analysis, get_lineage, get_claim_status, verify_disclosure. Ask the external agent to investigate your selected submission ID and cite its tool results. The official SDK client integration test initializes, discovers and calls these tools over HTTP, then verifies access denial and revocation. Actual Codex client setup is a separate user configuration step, not proven merely by SDK compatibility. Client subscriptions or paid model use are outside the free MCP server.

## Validation and limits

`npm run validate` runs the local acceptance suite; expanded corpus results are in detection-v2.json and detection-v2-entity.json. Those results use a harder corpus and should not be presented as directly comparable to the original corpus. Candidate recall and precision are measured, not guaranteed. Server-Timing and X-Duplera-RPC-Calls distinguish application work and RPC calls. Transaction timestamps measure server observation and include polling delay; they do not measure wallet approval latency. Browser extraction has a separate performance measure.

An approved lender can repeatedly reserve/cancel: the explicit squatting test documents this governance limitation; it does not claim to solve it. Audit results and collected notices are in dependency-licenses.json and THIRD_PARTY_NOTICES.txt; packages without bundled upstream notices remain flagged for review.
