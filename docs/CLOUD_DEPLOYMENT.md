# Supabase and Vercel deployment

The live Amoy registry is `0xB276dA7975e136306d2fab600b6Dfe058158F9E5` on chain 80002. Contract deployment and hosted database setup are complete. On 8 November 2026, both Supabase poolers were verified using TLS 1.3, with the correct registry binding, three lenders and RLS enabled on all 16 application tables. Evidence: `docs/results/cloud-database.json`. Vercel application deployment remains pending.

## 1. Configure the private local file

Run `npm run cloud:prepare` from the repository root. This creates `.local/cloud.env` once and preserves it on retries. It reuses the prepared analysis signer and registry secret, and never copies the administrator private key. This file is ignored by Git. Never paste its contents into chat.

In your Supabase project, click **Connect** and select a PostgreSQL connection string. Copy the **session pooler** URL (port 5432) into `SETUP_DATABASE_URL`, and the **transaction pooler** URL (port 6543) into `DATABASE_URL`. Replace the password placeholder locally with your URL-encoded database password. Preserve the project-specific pooler username and hostname. Add `?sslmode=verify-full`, or append `&sslmode=verify-full` if the URL already has query parameters. If certificate verification fails, resolve the certificate configuration rather than disabling verification.

Leave `APP_ORIGIN` blank until the final Vercel HTTPS origin is known. Do not replace the generated signer or registry secret. Supabase API keys and anon keys are not database connection strings and are not needed by this application.

## 2. Initialise Supabase

Download the database CA certificate from your Supabase project's Database Settings > SSL Configuration and save it as `.local/supabase-ca.crt`. Run `npm run cloud:setup`. The command explicitly reads `.local/cloud.env`, uses this certificate with hostname verification, does not fall back to the local database, checks the Amoy signer and configuration, and applies the schema, database binding, synthetic lender directory and row-level security in one transaction. It refuses to rebind an existing database to different registry secrets.

Use a dedicated Supabase project. The server uses a privileged PostgreSQL connection and enforces wallet ownership; browser Supabase Data API access is not used. No browser RLS policies are created by this setup.

## 3. Create the source repository

Initialise Git and create a private GitHub repository. Review the staged file list before the first push. Include source, root lockfile, workspace manifests and `deployments/amoy.json`. Exclude `.local`, `.env` secrets, dependencies, build output and generated test PDFs. Do not upload the project directory through a generic bulk upload without checking exclusions.

## 4. Import into Vercel

Import the repository, choose Next.js and set root directory to `apps/web`. Enable inclusion of source outside that directory when offered. Use the existing build command (`npm run build`) and framework output defaults. Set the Install Command override to `npm install --include=dev` so TypeScript build dependencies are installed. Root postinstall runs with plain Node.js and copies the PDF worker required by browser extraction; it does not depend on tsx.

Use **Node.js 22.x**. Web and internal workspace packages declare their own dependencies so filtered monorepo installs include the PDF worker and domain/evidence/matching packages. The copy script resolves PDF.js from the web workspace, supporting nested dependency layouts.

Set the following **Production server environment variables** from `.local/cloud.env`:

```text
DATABASE_URL
DEPLOYMENT_FILE
CHAIN_ID
REGISTRY_ADDRESS
RPC_URL
ANALYSIS_PRIVATE_KEY
REGISTRY_SECRET
CONFIRMATIONS
APP_ORIGIN
```

Do not upload `SETUP_DATABASE_URL` or an administrator private key to Vercel. Do not prefix secrets with `NEXT_PUBLIC_`. Set `APP_ORIGIN` to the assigned production origin, for example `https://your-project.vercel.app`, without a trailing slash or path. Redeploy after changing environment variables. Preview domains need their own matching origin and should not automatically share production data.

Run `npm run cloud:vercel` to verify the actual runtime TLS configuration against Supabase and generate ignored `.local/vercel.env`. Import this file in Vercel's Environment Variables section. It includes `DATABASE_CA_BASE64`, which transports the dashboard-downloaded public CA certificate as one line; runtime code keeps certificate and hostname verification enabled. It excludes the setup connection and administrator private key. If the production origin is not yet known, `APP_ORIGIN` is omitted: assign the actual HTTPS production origin after the first deployment and redeploy before wallet authentication. Do not share screenshots containing expanded variable values.

## 5. Validate the hosted workflow

Check that the API can read the bundled Amoy metadata and connect to Supabase. Test wallet authentication, invoice extraction, submission, matching, reservation, financing, receipt verification, reload persistence, owner isolation and release. Each lender wallet needs Amoy test POL and contract authorisation. Adding Amoy in MetaMask alone does not authorise its account. Decide whether to import a prepared test lender locally or explicitly authorise the user's chosen public account before the browser test.

Do not mark hosting complete until these checks pass on the public deployment. Source/explorer verification of a contract is distinct from application deployment and bytecode/receipt checks.

### Public RPC history limits

The dRPC free endpoint rejects `eth_getLogs` requests spanning more than 10,000 blocks. Disclosure export therefore retrieves the reservation receipt from the owner's saved transaction history first, and falls back to reverse searches in ranges of at most 2,000 blocks. Export checks canonical inclusion and the selected Merkle proofs before returning the package. The previous deployment-to-latest query failed after the chain advanced beyond the provider's range limit. Claim #1's three-field package was verified against live Supabase evidence and Amoy following this fix.

## References

- [Supabase database connections](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Vercel monorepos](https://vercel.com/docs/monorepos)
