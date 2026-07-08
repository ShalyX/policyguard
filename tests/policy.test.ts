import test from "node:test";
import assert from "node:assert/strict";
import { evaluatePolicy } from "../src/lib/policy";
import type { MarketEvidence, ProposedOrder } from "../src/lib/types";

const market: MarketEvidence = {
  provider: "PolicyGuard Demo Adapter",
  mode: "demo",
  capturedAt: new Date().toISOString(),
  latencyMs: 1,
  asset: "BTC",
  price: 100000,
  priceChange24hPct: 7.2,
  etfFlowUsd: 100000000,
  news: [{ title: "ETF inflows remain positive" }],
  endpoints: [],
  warnings: [],
};

const base: ProposedOrder = {
  asset: "BTC",
  side: "LONG",
  notionalUsd: 1000,
  leverage: 2,
  thesis: "ETF inflows and momentum support continuation, but the order should be checked against policy before execution.",
  sourceAgent: "test-agent",
  userPolicy: { maxNotionalUsd: 1500, maxLeverage: 3, requireHumanConfirmation: false },
};

test("policy engine creates a receipt and never marks demo data as submitted", () => {
  const receipt = evaluatePolicy(base, market);
  assert.ok(receipt.id);
  assert.notEqual(receipt.execution.status, "submitted");
  assert.equal(receipt.market.mode, "demo");
});

test("policy engine rejects hard limit failures", () => {
  const receipt = evaluatePolicy({ ...base, notionalUsd: 10000, leverage: 10 }, market);
  assert.equal(receipt.verdict, "REJECT");
  assert.equal(receipt.approvedNotionalUsd, 0);
});
