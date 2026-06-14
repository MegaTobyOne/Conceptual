import assert from "node:assert/strict";
import test from "node:test";
import { isAiEnabled } from "./index.js";

test("AI stays disabled when the user setting is false", () => {
  assert.equal(
    isAiEnabled({
      settingEnabled: false,
      policyDisabled: false,
      capabilityInstalled: true,
      providerAvailable: true
    }),
    false
  );
});

test("AI stays disabled when workspace policy disables it", () => {
  assert.equal(
    isAiEnabled({
      settingEnabled: true,
      policyDisabled: true,
      capabilityInstalled: true,
      providerAvailable: true
    }),
    false
  );
});

test("AI enables only when every guard passes", () => {
  assert.equal(
    isAiEnabled({
      settingEnabled: true,
      policyDisabled: false,
      capabilityInstalled: true,
      providerAvailable: true
    }),
    true
  );
});

test("AI disables when provider capability is unavailable", () => {
  assert.equal(
    isAiEnabled({
      settingEnabled: true,
      policyDisabled: false,
      capabilityInstalled: true,
      providerAvailable: false
    }),
    false
  );
});
