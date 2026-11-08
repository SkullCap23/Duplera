# Polygon Amoy deployment

## Completed deployment — 8 November 2026

The dedicated administrator received 1 test POL through the Polygon faucet. The registry was deployed at **[0xB276dA7975e136306d2fab600b6Dfe058158F9E5](https://amoy.polygonscan.com/address/0xB276dA7975e136306d2fab600b6Dfe058158F9E5)**, in block 52324037.

[Deployment transaction](https://amoy.polygonscan.com/tx/0x45b5263836485b67e1e1a359f60aac17abc09e7ba44bf381542929c015420d08). All three prepared lenders were authorised through separate successful transactions. A subsequent read-only verification checked deployed bytecode, administrator role, analysis signer, all lender roles, canonical receipt block hashes, and at least two confirmations for all four transactions.

Public deployment metadata: `deployments/amoy.json`. Verification evidence, exact fees, transaction hashes and observed confirmations: `docs/results/amoy-deployment.json`. Repeat read-only verification with `npx tsx scripts/verify-amoy.ts`. Total deployment and authorisation fees were approximately **0.05208021 test POL**; the observed remaining administrator balance was **0.947919789889062382 test POL**.

This completes contract deployment and permission setup only. Cloud database setup, hosted application configuration and end-to-end public-network claim testing remain separate steps. No database or hosting services were started for this deployment.

The complete core runs locally. Public deployment is conditional on a separately configured test wallet, an available RPC and no-purchase faucet eligibility. The project never requires purchasing cryptocurrency.

Polygon documents Amoy chain ID **80002**, native test POL and the [Amoy explorer](https://amoy.polygonscan.com/). Pick an endpoint from the current [official RPC list](https://docs.polygon.technology/pos/reference/rpc-endpoints/). The older first-party RPC was deprecated; do not copy it from old tutorials. [Polygon network setup](https://support.polygon.technology/support/solutions/articles/82000907114-how-to-add-amoy-network-in-your-wallet-), [RPC deprecation announcement](https://forum.polygon.technology/t/deprecation-of-polygons-public-rpc-endpoints-mainnet-amoy/22014).

## Configure locally

Use separate test-only admin, analysis signer and three lender accounts. Do not use published Hardhat keys on a public network. Set these shell variables or load them from your own ignored environment file:

`npm run amoy:prepare` creates dedicated accounts once, stores keys only in ignored `.local/amoy-wallets.json`, and writes `.local/amoy.env`. Re-running preparation preserves those accounts. Public addresses are available in `.local/amoy-addresses.json`; do not paste private keys into chat. `npm run amoy:check` reads that environment automatically and makes no transaction submissions.

* `AMOY_RPC_URL`: selected working endpoint.
* `AMOY_DEPLOYER_PRIVATE_KEY`: test administrator key with test POL.
* `AMOY_ANALYSIS_SIGNER`: public address of the separately held analysis signer.
* `AMOY_LENDERS`: three comma-separated lender addresses.

Run `npm run compile`, then `npm run amoy:check`. The preflight verifies chain identity, separate accounts and balance, then estimates deployment gas if funded. `npm run deploy:amoy` submits only on chain 80002. Every transaction is signed and journalled before broadcast in ignored `.local/amoy-deployment.json`. Retrying uses the same raw transaction/hash, including after interruption; it does not create a fresh contract. A local lock prevents concurrent deployment runs. After an actual crash, inspect the recorded PID/receipts before removing a stale `.lock` file. A changed account/configuration is rejected against the journal.

The finished deployment metadata is written to `deployments/amoy.json`. Configure the web app using:

```text
DEPLOYMENT_FILE=deployments/amoy.json
CHAIN_ID=80002
REGISTRY_ADDRESS=<recorded address>
RPC_URL=<working Amoy RPC>
ANALYSIS_PRIVATE_KEY=<separate signer key>
REGISTRY_SECRET=<at least 32 cryptographically random bytes>
CONFIRMATIONS=2
APP_ORIGIN=<exact application origin>
DATABASE_URL=<dedicated synthetic-data database>
```

Do not reuse a populated local registry database as a fresh public deployment. Secret/schema changes require an explicit migration. The web server refuses mismatches between configured chain/address and deployment metadata. Configure each lender wallet for the same chain. Confirmation counts are application policies, not mathematical finality.

## Eligibility record

This repository includes preflight and deployment tooling. Successful faucet access, deployed Amoy bytecode and public-network measurements must be recorded only after they actually occur. If a provider requires login, CAPTCHA, prior balances or an unavailable allowance, retain the fully local fallback. No purchase is needed for the course demo.

On 3 November 2026, the configured dRPC endpoint returned chain 80002 and the prepared administrator balance was zero. No public transaction was submitted. Administrator address: `0xfd26D0628a1ebb8B992f12257FF92BbfC21B116f`. The analysis signer does not need gas for off-chain signatures. Administrator and lender wallets need eligible faucet test POL for their respective deployment/lifecycle transactions.
