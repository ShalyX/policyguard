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

test("policy engine creates a decision without execution (execution is attached async)", () => {
  const decision = evaluatePolicy(base, market);
  assert.ok(decision.id);
  assert.ok(decision.verdict);
  assert.equal(decision.market.mode, "demo");
  assert.ok(!("execution" in decision) || (decision as { execution?: unknown }).execution === undefined);
});

test("policy engine rejects hard limit failures", () => {
  const decision = evaluatePolicy({ ...base, notionalUsd: 10000, leverage: 10 }, market);
  assert.equal(decision.verdict, "REJECT");
  assert.equal(decision.approvedNotionalUsd, 0);
});
