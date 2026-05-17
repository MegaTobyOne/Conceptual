# PSPF Shop

PSPF Shop is the commercial planning surface for suppliers, contracts, spend items, and derived spend forecast review.

ADR 0050 reopened the earlier Shop deferral for a standalone first slice. ADR 0051 promotes supplier, contract, and spend-item records into the canonical contracts model and Explorer bundle schema while keeping Shop's editable store at `.pspf/shop/shop.json` for the extension user experience.

The extension keeps a compatibility read path for v1.15 local records and normalises them into the v1.16 canonical local store shape.

The next planned slice is Core-backed Shop authoring: read/write commercial records through Core, provide an explicit sync/import path from the local Shop JSON store, and surface validation/publishability status without adding procurement import or finance reconciliation.