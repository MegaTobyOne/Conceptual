# PSPF Shop

PSPF Shop is the commercial planning surface for suppliers, contracts, spend items, and derived spend forecast review.

ADR 0050 reopens the earlier Shop deferral for a standalone first slice. In v1.15, Shop stores data in `.pspf/shop/shop.json` inside the active workspace and does not publish Shop content into Core, Workshop, Explorer, snapshots, export bundles, logs, or telemetry.

This package intentionally keeps supplier, contract, and spend-item records local to the extension until a later slice promotes them into the canonical contracts, Core storage engine, and Explorer bundle schema.