# PSPF Shop

PSPF Shop is the commercial planning surface for suppliers, contracts, spend items, and derived spend forecast review.

ADR 0050 reopened the earlier Shop deferral for a standalone first slice. ADR 0051 promotes supplier, contract, and spend-item records into the canonical contracts model and Explorer bundle schema while keeping Shop's editable store at `.pspf/shop/shop.json` for the extension user experience.

The extension keeps a compatibility import path for v1.15 and v1.16 local records and normalises them into the v1.17 Core-backed store shape.

Shop now reads and writes commercial records through Core. The local JSON file is a compatibility import source, not the active system of record.