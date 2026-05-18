#!/usr/bin/env node
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";

const extensionId = process.env.EXTENSION_ID;
const expectedVersion = process.env.EXPECTED_VERSION;
const attempts = Number(process.env.MARKETPLACE_VERIFY_ATTEMPTS ?? "12");
const delayMs = Number(process.env.MARKETPLACE_VERIFY_DELAY_MS ?? "60000");

assert.ok(extensionId, "EXTENSION_ID is required");
assert.ok(expectedVersion, "EXPECTED_VERSION is required");
assert.ok(Number.isInteger(attempts) && attempts > 0, "MARKETPLACE_VERIFY_ATTEMPTS must be a positive integer");
assert.ok(Number.isInteger(delayMs) && delayMs >= 0, "MARKETPLACE_VERIFY_DELAY_MS must be a non-negative integer");

async function readMarketplaceVersion() {
    const response = await fetch("https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery?api-version=3.0-preview.1", {
        method: "POST",
        headers: {
            "Accept": "application/json;api-version=3.0-preview.1",
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            filters: [
                {
                    criteria: [{ filterType: 7, value: extensionId }],
                    pageNumber: 1,
                    pageSize: 1,
                    sortBy: 0,
                    sortOrder: 0
                }
            ],
            assetTypes: [],
            flags: 914
        })
    });

    if (!response.ok) {
        throw new Error(`Marketplace Gallery API returned ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const extension = data?.results?.[0]?.extensions?.[0];
    return extension?.versions?.[0]?.version ?? "";
}

for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const actualVersion = await readMarketplaceVersion();
    if (actualVersion === expectedVersion) {
        console.log(`Marketplace shows ${extensionId}@${expectedVersion}.`);
        process.exit(0);
    }

    console.log(`Attempt ${attempt}: Marketplace reports '${actualVersion || "missing"}' for ${extensionId}, expected ${expectedVersion}.`);
    if (attempt < attempts && delayMs > 0) {
        console.log(`Waiting ${Math.round(delayMs / 1000)} second(s) before checking Marketplace again.`);
        await delay(delayMs);
    }
}

console.error(`Marketplace did not report ${extensionId}@${expectedVersion} after ${attempts} attempt(s).`);
process.exit(1);
