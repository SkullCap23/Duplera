# End-to-end extension acceptance tracker

Work started 20 November 2026. Existing live claims, secrets and deployment remain intact. No item is complete merely because code exists: tests and deployment evidence are required.

| Item | Acceptance condition | Status |
|---|---|---|
| 1 Structured line items | Validated items, order-independent matching and evidence binding | Implemented; local acceptance passed |
| 2 Indexed retrieval | SQL candidate unions, indexes, no global latest-10k truncation | Implemented; local acceptance passed |
| 3 Raw digest lookup | Independent indexed lookup across all submissions | Implemented; local acceptance passed |
| 4 Mutation coverage | Font, whitespace, metadata and item-reordering PDFs | Implemented; local acceptance passed |
| 5 Scenario coverage | Namespace and post-release labels/tests | Implemented; local acceptance passed |
| 6 Diverse data | Multiple countries/currencies, integer minor units | Implemented; local acceptance passed |
| 7 Metrics | Separate extraction/matching, RPC and transaction timing | Implemented; local acceptance passed |
| 8 Outages | Fail closed and recover across DB/backend/RPC faults | Implemented; local acceptance passed |
| 9 Squatting | Explicit repeat-reservation abuse test | Implemented; local acceptance passed |
| 10 Local restart | Dedicated reset database, preserved previous data, one-command start | Implemented; local acceptance passed |
| 11 Regression | Full final acceptance suite | Implemented; local acceptance passed |
| 12 Licences | Installed dependency inventory and notices | Implemented; local acceptance passed |
| 13 Supplier issuance | Registered keys, signed versions, linear amendments, stable token, UI and tests | Implemented; local acceptance passed |
| 14 Investigation | Permission-scoped tools, grounded case brief, bounded free/local LLM | Implemented; local acceptance passed |
| 15 MCP | Authenticated remote transport, token revocation, audit and client tests | Implemented; local acceptance passed |

Hosted Gemini testing requires a user-supplied free-tier API key; local Ollama requires a locally available model. Never silently substitute mock output for a live LLM result or use a paid fallback. External client usage is governed by the client's own plan.

## Rollout state

Supabase additive schema and RLS applied successfully after the user resumed the project. Local acceptance.json is complete; eight Playwright workflows passed. Live Gemini tool calling passed with the user-supplied key. Hosted deployment c6b7b44 is Ready. Hosted Gemini investigation and MCP SDK acceptance passed; the MCP run used an isolated Playwright HTTP fetch adapter after native fetch connection resets. Independent signature recovery verified both amendment versions and their predecessor link; scoped access and token revocation passed. No financing transactions were broadcast by the hosted extension smoke. Actual external Codex client setup remains a separate configuration step. Optional Ollama adapter has no installed-model live result. Dependency audit retains upstream notice-review flags for solidity-analyzer packages; no unknown declared licences. No mandatory paid fallback is configured.
