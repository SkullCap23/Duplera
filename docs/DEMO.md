# Local demonstration script

Run the services and setup commands in the README. Use three separate test-wallet accounts. Verify the app's exact origin, chain 31337 and deployed address before beginning. Start with an unused generated invoice family if an earlier demo left an active claim.

1. Lender A signs in, uploads a base invoice, checks fields and runs analysis. Reserve, inspect the recorded claim, and confirm financing. Explain that this is a lender declaration, not an observed payment.
2. Reload the browser. Open Saved workspace and recover the claim through its transaction history. Select the saved submission for later evidence export.
3. Lender B submits the layout and amount variants. Show that their file hashes differ while recognised identity remains stable. An active exact claim cannot be overridden by a fuzzy review or direct call.
4. Try a number variant and inspect individual similarity signals. Record an attributed review disposition. Explain that this is a potential relationship, not a fraud verdict. Try the multi variant to show a documented evasion.
5. From A's saved submission/claim, select invoice number and amount, then export the disclosure package. The investigator verifies it with the read-only UI and independent CLI. Edit a value, salt or proof to demonstrate rejection.
6. A releases financing. Analyse the same business identity again, reserve and demonstrate a new claim ID with retained historical evidence. FINANCED claims never expire by time alone.
7. Show the held-out/entity-held-out results, including recurring-lookalike false alerts, then the separate SQL/local-EVM measurements. Explain signer trust, public metadata, participation limits and non-authenticity of synthetic invoices.

For recovery/security demonstrations, run `npm run test:projection` and `npm run test:e2e` on the local chain. These tests manipulate the miner and use snapshots, so do not submit concurrent manual transactions during them. `npm run test:baseline` demonstrates the database alternative's real concurrency and signature controls. Amoy is optional; the local demo remains independent of cloud/faucet availability.

A narrated recording and final course report should be made from the team's agreed final version. Do not present test automation alone as a completed narrated presentation.
