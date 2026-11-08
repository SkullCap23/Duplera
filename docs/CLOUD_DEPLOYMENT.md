# Supabase and Vercel deployment

The live Amoy registry is `0xB276dA7975e136306d2fab600b6Dfe058158F9E5` on chain 80002. Contract deployment is complete. Hosted database and application deployment remain pending until the cloud project connection details are configured.

## 1. Configure the private local file

Run `npm run cloud:prepare` from the repository root. This creates `.local/cloud.env` once and preserves it on retries. It reuses the prepared analysis signer and registry secret, and never copies the administrator private key. This file is ignored by Git. Never paste its contents into chat.

In your Supabase project, click **Connect** and select a PostgreSQL connection string. Copy the **session pooler** URL (port 5432) into `SETUP_DATABASE_URL`, and the **transaction pooler** URL (port 6543) into `DATABASE_URL`. Replace the password placeholder locally with your URL-encoded database password. Preserve the project-specific pooler username and hostname. Add `?sslmode=verify-full`, or append `&sslmode=verify-full` if the URL already has query parameters. If certificate verification fails, resolve the certificate configuration rather than disabling verification.

Leave `APP_ORIGIN` blank until the final Vercel HTTPS origin is known. Do not replace the generated signer or registry secret. Supabase API keys and anon keys are not database connection strings and are not needed by this application.

## 2. Initialise Supabase

Run `npm run cloud:setup`. The command explicitly reads `.local/cloud.env`, does not fall back to the local database, checks the Amoy signer and configuration, and applies the schema, database binding, synthetic lender directory and row-level security in one transaction. It refuses to rebind an existing database to different registry secrets.

Use a dedicated Supabase project. The server uses a privileged PostgreSQL connection and enforces wallet ownership; browser Supabase Data API access is not used. No browser RLS policies are created by this setup.

## 3. Create the source repository

Initialise Git and create a private GitHub repository. Review the staged file list before the first push. Include source, root lockfile, workspace manifests and `deployments/amoy.json`. Exclude `.local`, `.env` secrets, dependencies, build output and generated test PDFs. Do not upload the project directory through a generic bulk upload without checking exclusions.

## 4. Import into Vercel

Import the repository, choose Next.js and set root directory to `apps/web`. Enable inclusion of source outside that directory when offered. Use the existing build command (`npm run build`) and framework output defaults. Install the full npm workspace, including development dependencies required by the root postinstall/build tooling. Root postinstall copies the PDF worker required by browser extraction.

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

## 5. Validate the hosted workflow

Check that the API can read the bundled Amoy metadata and connect to Supabase. Test wallet authentication, invoice extraction, submission, matching, reservation, financing, receipt verification, reload persistence, owner isolation and release. Each lender wallet needs Amoy test POL and contract authorisation. Adding Amoy in MetaMask alone does not authorise its account. Decide whether to import a prepared test lender locally or explicitly authorise the user's chosen public account before the browser test.

Do not mark hosting complete until these checks pass on the public deployment. Source/explorer verification of a contract is distinct from application deployment and bytecode/receipt checks.

## References

- [Supabase database connections](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Vercel monorepos](https://vercel.com/docs/monorepos)
