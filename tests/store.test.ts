import test from "node:test";
import assert from "node:assert/strict";
import { evaluatePolicy } from "../src/lib/policy";
import { getReceipt, makePortableReceiptId } from "../src/lib/store";
import type { MarketEvidence, ProposedOrder } from "../src/lib/types";

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

test("portable receipt id can recover a receipt without local filesystem state", async () => {
  const receipt = evaluatePolicy(order, market);
  const id = makePortableReceiptId(receipt);
  const recovered = await getReceipt(id);
  assert.ok(recovered);
  assert.equal(recovered.id, id);
  assert.equal(recovered.verdict, receipt.verdict);
  assert.equal(recovered.market.mode, "demo");
});
