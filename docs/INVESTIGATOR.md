# Read-only investigation

An investigator receives a disclosure package exported by the submission's authenticated owner. The holder can verify that package in the Evidence verifier tab or with `npm run verify:receipt -- path/to/package.json`. The CLI reads the configured chain directly, checks the canonical reservation transaction/block and selected field proofs, and never uses PostgreSQL or the application API.

No investigator account grants access to every lender's invoices. Ownership predicates protect private API records. Export is an explicit owner-controlled act; deliver the JSON through the team's agreed private channel. The package contains exactly the selected values, their salts and Merkle paths, plus public registry references. The owner should inspect those fields before sharing. This application does not send packages to third parties.

The public read-only verifier accepts an already disclosed package and has no financing mutation controls. Possession of the package reveals its selected values; there is no subsequent revocation of disclosure. Verification proves consistency and chain inclusion, not invoice authenticity, legal rights, hidden-field matching or correctly computed fuzzy scores.

For independent verification, obtain the deployment address and RPC configuration separately from the package. Otherwise a counterfeit deployment supplied by an adversary could appear internally consistent. The CLI requires the package to match the independently selected deployment file.
