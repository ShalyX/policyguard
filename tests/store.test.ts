import test from "node:test";
import assert from "node:assert/strict";
import { evaluatePolicy } from "../src/lib/policy";
import { attachSodexExecution } from "../src/lib/sodex";
import { getReceipt, makeSharePacket } from "../src/lib/store";
import type { MarketEvidence, PolicyReceipt, ProposedOrder } from "../src/lib/types";

const order: ProposedOrder = {
  asset: "BTC",
  side: "LONG",
  notionalUsd: 1200,
  leverage: 2,
  thesis: "ETF inflows and positive market momentum support continuation, while PolicyGuard checks sizing and news risk before execution.",
  sourceAgent: "portable-test-agent",
  userPolicy: { maxNotionalUsd: 1500, maxLeverage: 3, requireHumanConfirmation: true },
};

const market: MarketEvidence = {
  provider: "PolicyGuard Demo Adapter",
  mode: "demo",
  capturedAt: new Date().toISOString(),
  latencyMs: 1,
  asset: "BTC",
  price: 100000,
  priceChange24hPct: 2,
  etfFlowUsd: 100000000,
  news: [{ title: "ETF inflows remain positive" }],
  endpoints: [],
  warnings: [],
};

test("share packet can recover a receipt without local filesystem state", async () => {
  const decision = evaluatePolicy(order, market);
  const execution = await attachSodexExecution({
    order,
    market,
    verdict: decision.verdict,
    approvedNotionalUsd: decision.approvedNotionalUsd,
  });
  const receipt: PolicyReceipt = { ...decision, execution };
  const packet = makeSharePacket(receipt);
  const recovered = await getReceipt(receipt.id, packet);
  assert.ok(recovered);
  assert.equal(recovered.id, receipt.id);
  assert.equal(recovered.verdict, receipt.verdict);
  assert.equal(recovered.market.mode, "demo");
  assert.ok(recovered.execution.status === "prepared" || recovered.execution.status === "blocked");
});
