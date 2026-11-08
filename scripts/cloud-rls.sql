-- Server uses the database role through pg. No browser Supabase Data API access is needed.
-- Run after db:setup on the dedicated hosted database.
DO $$
DECLARE table_name text;
BEGIN
 FOREACH table_name IN ARRAY ARRAY['challenges','sessions','submissions','analyses','attestations','chain_events','baseline_claims','baseline_audit','attestation_requests','wallet_transactions','baseline_members','baseline_nonces','api_limits','projection_cursors','registry_configuration','institutions']
 LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',table_name);
 END LOOP;
END $$;
-- Deliberately no anon/authenticated policies. The server's privileged database connection
-- enforces wallet ownership. Do not place its connection string in NEXT_PUBLIC variables.
