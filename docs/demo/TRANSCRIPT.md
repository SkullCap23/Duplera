# Narrated local walkthrough

## Duplera: a local synthetic-data demonstration

Duplera is a blockchain registry for duplicate invoice financing claims. This walkthrough uses synthetic invoices, a local E V M chain, and automated test wallets. It does not transfer money or prove that a trade is authentic.

## Invoice extraction and explainable review

The original PDF is processed in the browser. The lender confirms its fields, then the service checks stable business identity and explained similarity signals. Possible relationships require a recorded review. A similarity score is a heuristic, not a fraud probability.

## An authoritative financing claim

The lender signs the reservation and financing confirmation. The contract checks membership, a context bound analysis signature, nonce replay and active claim exclusivity. The immutable claim stores the evidence commitment. Financing remains active until this lender explicitly releases it.

## A second lender encounters an exact conflict

A second lender submits the same invoice. The live registry reports an active exact claim, so a new reservation is blocked. This protection is enforced by the contract, including for direct callers. Public observers still see token equality, addresses and timing.

## Selective evidence and canonical inclusion

The owner discloses only selected fields with their salted Merkle proofs. Verification checks the recorded root, reservation transaction and canonical block. A separate command line verifier can do this directly through R P C, without the application database.

## Tampering fails verification

Changing a disclosed value makes verification fail. This establishes consistency with what was committed. It does not establish supplier authenticity, legal priority, hidden field matching or a real payment. The synthetic benchmark also records false alerts and known detection misses.

## Saved history and recovery

The signed session and private workspace recover after a reload. Transaction receipts are reconciled with the chain, and pending, failed, dropped and reorganised transactions remain distinct. The full local acceptance suite and measured reports are included in the repository.
