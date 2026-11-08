# Literature review notes and source-access record

These notes distinguish inspected evidence from the reading list. They support the design discussion, not a claim that every paper in the supplied bibliography has been fully reviewed.

| Source | Material inspected | Relevance to Duplera |
|---|---|---|
| Peter Christen, A Survey of Indexing Techniques for Scalable Record Linkage and Deduplication | Author-hosted 20-page preprint; introduction/process/indexing discussion and evaluation discussion on PDF pages 1–3 and 17–18 | Separates normalisation, candidate generation, comparison, classification and review. Candidate quality can limit downstream matching, so Duplera measures candidate recall separately and uses multiple retrieval signals. |
| Karl Wüst and Arthur Gervais, Do you need a blockchain? | ETH Zurich's publication record/abstract; the originally supplied IACR PDF returned HTTP 403, and a discovered ETH PDF URL returned 404 | Provides a methodology for choosing between blockchain types and a central database. Duplera's SQL reference and explicit operator/trust assumptions answer this architectural question. No numerical result from this paper is reused. |
| A Fraud-Resilient Blockchain-Based Solution for Invoice Financing | University of Padua indexed publication metadata/abstract; direct full-text and repository page requests returned HTTP 403 | Identifies established invoice-financing blockchain work. It prevents treating a blockchain invoice registry as an original research invention. Full-text mechanisms and experimental comparisons are not asserted here. |

The record-linkage preprint discusses the cost/quality trade-off in reducing candidate pairs and the importance of blocking-key choice. Our bounded candidate union is a simple engineering implementation inspired by that separation; it is not a reproduction of the paper's experimental framework or its surveyed indexing techniques. Our synthetic outcomes must not be presented as the paper's results.

## Primary references

* [Christen author preprint](https://users.cecs.anu.edu.au/~christen/publications/christen2011indexing.pdf). The downloaded version carries a 2011 preprint header; the supplied bibliography lists the later publication as 2012. Keep version dates distinct.
* [Wüst and Gervais, ETH Zurich publication record](https://syssec.ethz.ch/publications/2018-06-20-do-you-need-a-blockchain-20-500-11850-312301/).
* [Invoice-financing publication, University of Padua](https://www.research.unipd.it/handle/11577/3329121).

Source-access checks were performed on 3 November 2026. Downloaded papers are stored only in ignored `.local/literature`, not redistributed in the repository. `npm run literature:fetch` records actual success/failure; it never fabricates an available paper. The remaining privacy, oracle, front-running and supply-chain papers in the supplied reading list still require source-by-source review before a complete academic literature chapter is claimed.
