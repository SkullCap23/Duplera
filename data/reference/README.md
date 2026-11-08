# Aggregate trade context

`npm run data:comtrade` makes one bounded, unauthenticated UN Comtrade preview API request (at most five records) and records source, period, classification, parameters, retrieval time, checksum and transformations. Successful retrieval creates `comtrade-preview.json` and `trade-context.json`; failure records an unavailable status without inventing data.

Source: UN Comtrade. The small sample is for this free, non-commercial university demonstration under the [limited-data redistribution guidance](https://uncomtrade.org/docs/re-dissemination-of-data/). Source terms and attribution remain attached. The public preview endpoint is described in the [official API guide](https://uncomtrade.org/docs/un-comtrade-api/).

The generator optionally reuses a cached commodity description for some synthetic invoices. Countries and commodity context describe aggregate trade, not actual invoice counterparties. Every supplier, buyer, invoice, amount and relationship label remains synthetic. Aggregate unit values are never represented as verified invoice prices. No subscription key is required or stored.
