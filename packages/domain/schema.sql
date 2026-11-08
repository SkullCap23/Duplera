CREATE TABLE IF NOT EXISTS challenges (
 id uuid PRIMARY KEY, wallet text NOT NULL, message text NOT NULL, expires_at timestamptz NOT NULL, consumed boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash text PRIMARY KEY, wallet text NOT NULL, expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS submissions (
 id uuid PRIMARY KEY, owner text NOT NULL, idempotency_key uuid NOT NULL,
 original jsonb NOT NULL, normalised jsonb NOT NULL, pdf_digest text NOT NULL,
 matching_token text NOT NULL, evidence jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(owner,idempotency_key)
);
CREATE INDEX IF NOT EXISTS submissions_token_idx ON submissions(matching_token);
CREATE INDEX IF NOT EXISTS submissions_owner_idx ON submissions(owner);
CREATE TABLE IF NOT EXISTS analyses (
 id uuid PRIMARY KEY, submission_id uuid NOT NULL REFERENCES submissions(id), owner text NOT NULL,
 result jsonb NOT NULL, review text, reviewed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS attestations (
 id uuid PRIMARY KEY, submission_id uuid NOT NULL REFERENCES submissions(id), owner text NOT NULL,
 payload jsonb NOT NULL, signature text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS chain_events (
 chain_id bigint NOT NULL, registry text NOT NULL, tx_hash text NOT NULL, log_index integer NOT NULL,
 block_number bigint NOT NULL, block_hash text NOT NULL, event_name text NOT NULL, payload jsonb NOT NULL,
 PRIMARY KEY(chain_id,registry,tx_hash,log_index)
);
CREATE TABLE IF NOT EXISTS baseline_claims (
 id bigserial PRIMARY KEY, token text NOT NULL, lender text NOT NULL, root text NOT NULL,
 state text NOT NULL CHECK(state IN ('RESERVED','FINANCED','CANCELLED','EXPIRED','RELEASED')),
 deadline timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS baseline_active_token ON baseline_claims(token) WHERE state IN ('RESERVED','FINANCED');
CREATE TABLE IF NOT EXISTS baseline_audit (
 id bigserial PRIMARY KEY, claim_id bigint NOT NULL REFERENCES baseline_claims(id), actor text NOT NULL,
 action text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS attestation_requests (
 owner text NOT NULL, request_key uuid NOT NULL, submission_id uuid NOT NULL REFERENCES submissions(id),
 analysis_id uuid NOT NULL REFERENCES analyses(id), response jsonb NOT NULL,
 PRIMARY KEY(owner,request_key)
);
CREATE TABLE IF NOT EXISTS wallet_transactions (
 chain_id bigint NOT NULL, registry text NOT NULL, tx_hash text NOT NULL,
 owner text NOT NULL, submission_id uuid REFERENCES submissions(id), action text NOT NULL,
 claim_id text, status text NOT NULL DEFAULT 'SUBMITTED', block_number bigint, block_hash text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(chain_id,registry,tx_hash)
);
CREATE TABLE IF NOT EXISTS baseline_members (
 wallet text PRIMARY KEY, approved boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS baseline_nonces (
 nonce text PRIMARY KEY, claim_id bigint NOT NULL REFERENCES baseline_claims(id)
);
ALTER TABLE baseline_claims ADD COLUMN IF NOT EXISTS context text;
ALTER TABLE baseline_claims ADD COLUMN IF NOT EXISTS schema_version integer NOT NULL DEFAULT 1;
CREATE TABLE IF NOT EXISTS api_limits (
 scope text NOT NULL, subject text NOT NULL, bucket bigint NOT NULL, used integer NOT NULL,
 PRIMARY KEY(scope,subject,bucket)
);
CREATE TABLE IF NOT EXISTS projection_cursors (
 chain_id bigint NOT NULL, registry text NOT NULL, block_number bigint NOT NULL, block_hash text NOT NULL,
 PRIMARY KEY(chain_id,registry)
);
CREATE TABLE IF NOT EXISTS registry_configuration (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), chain_id bigint NOT NULL,
 registry text NOT NULL, analysis_signer text NOT NULL, secret_fingerprint text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS institutions (
 chain_id bigint NOT NULL, registry text NOT NULL, synthetic_id text NOT NULL, name text NOT NULL, wallet text NOT NULL,
 PRIMARY KEY(chain_id,registry,wallet), UNIQUE(chain_id,registry,synthetic_id)
);
