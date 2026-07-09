import test from "node:test";
import assert from "node:assert/strict";
import { privateKeyToAccount } from "viem/accounts";
import {
  attachSodexExecution,
  buildNewOrderSigningPayload,
  signExchangeAction,
} from "../src/lib/sodex";
import type { MarketEvidence, ProposedOrder } from "../src/lib/types";

const market: MarketEvidence = {
  provider: "PolicyGuard Demo Adapter",
  mode: "demo",
  capturedAt: new Date().toISOString(),
  latencyMs: 1,
  asset: "BTC",
  price: 100000,
  priceChange24hPct: 1.2,
  etfFlowUsd: 50_000_000,
  news: [{ title: "ETF inflows remain positive" }],
  endpoints: [],
  warnings: [],
};

const base: ProposedOrder = {
  asset: "BTC",
  side: "LONG",
  notionalUsd: 1000,
  leverage: 2,
  thesis: "ETF inflows and positive market momentum support a continuation trade after policy sizing checks.",
  sourceAgent: "test-agent",
  userPolicy: { maxNotionalUsd: 1500, maxLeverage: 3, requireHumanConfirmation: false },
};

test("buildNewOrderSigningPayload keeps Go-compatible field order for market buy funds", () => {
  const { compactSigningJson, httpBody } = buildNewOrderSigningPayload({
    accountID: 12345,
    symbolID: 1,
    clOrdID: "pg-test-1",
    side: 1,
    type: 2,
    timeInForce: 3,
    funds: "1000",
  });
  assert.equal(
    compactSigningJson,
    '{"type":"newOrder","params":{"accountID":12345,"symbolID":1,"orders":[{"clOrdID":"pg-test-1","modifier":1,"side":1,"type":2,"timeInForce":3,"funds":"1000","reduceOnly":false,"positionSide":1}]}}',
  );
  assert.deepEqual(httpBody.accountID, 12345);
  assert.ok(!("type" in httpBody));
});

test("signExchangeAction returns 0x01-prefixed signature", async () => {
  const pk = "0x2222222222222222222222222222222222222222222222222222222222222222" as const;
  const account = privateKeyToAccount(pk);
  assert.ok(account.address.startsWith("0x"));
  const { compactSigningJson } = buildNewOrderSigningPayload({
    accountID: 1,
    symbolID: 1,
    clOrdID: "pg-sign-1",
    side: 1,
    type: 2,
    timeInForce: 3,
    funds: "25",
  });
  const signed = await signExchangeAction({
    privateKey: pk,
    chainId: 138565,
    domainName: "futures",
    compactSigningJson,
    nonce: 1760373925001,
  });
  assert.match(signed.payloadHash, /^0x[0-9a-f]{64}$/i);
  assert.match(signed.signature, /^0x01[0-9a-f]{130}$/i);
});

test("attachSodexExecution never marks status submitted without a successful external response", async () => {
  delete process.env.SODEX_TESTNET_SUBMIT_ENABLED;
  delete process.env.SODEX_TESTNET_API_KEY;
  delete process.env.SODEX_TESTNET_PRIVATE_KEY;
  delete process.env.SODEX_TESTNET_ACCOUNT_ID;

  const execution = await attachSodexExecution({
    order: base,
    market,
    verdict: "APPROVE",
    approvedNotionalUsd: 1000,
  });
  assert.equal(execution.status, "prepared");
  assert.equal(execution.submitAttempted, false);
  assert.ok(execution.preparedOrder);
  assert.equal(execution.preparedOrder?.market, "BTC-USD");
});

test("attachSodexExecution submits when credentials + enabled gate + mock SoDEX 0 response", async () => {
  process.env.SODEX_TESTNET_SUBMIT_ENABLED = "true";
  process.env.SODEX_TESTNET_SIGN_MODE = "api_key";
  process.env.SODEX_TESTNET_API_KEY = "api-key-01";
  process.env.SODEX_TESTNET_PRIVATE_KEY = "0x2222222222222222222222222222222222222222222222222222222222222222";
  process.env.SODEX_TESTNET_ACCOUNT_ID = "12345";
  process.env.SODEX_TESTNET_SUBMIT_URL = "https://sodex.testnet.example/api/v1/perps/trade/orders";

  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("markets/tickers")) {
      return new Response(JSON.stringify({ code: 0, data: [{ markPrice: "100000" }] }), { status: 200 });
    }
    if (url.includes("trade/orders")) {
      const headers = init?.headers as Record<string, string>;
      assert.equal(headers["X-API-Key"], "api-key-01");
      assert.match(String(headers["X-API-Sign"]), /^0x01/);
      assert.ok(headers["X-API-Nonce"]);
      const body = JSON.parse(String(init?.body));
      assert.equal(body.accountID, 12345);
      assert.equal(body.symbolID, 1);
      assert.ok(body.orders[0].funds);
      assert.equal(body.orders[0].type, 2);
      return new Response(JSON.stringify({ code: 0, data: [{ code: 0, clOrdID: body.orders[0].clOrdID, orderID: 998877 }] }), {
        status: 200,
      });
    }
    return new Response("not found", { status: 404 });
  };

  const execution = await attachSodexExecution({
    order: base,
    market,
    verdict: "APPROVE",
    approvedNotionalUsd: 1000,
    fetchImpl: fetchImpl as typeof fetch,
  });

  assert.equal(execution.status, "submitted");
  assert.equal(execution.sodexOrderId, "998877");
  assert.equal(execution.submitAttempted, true);
  assert.equal(execution.submitHttpStatus, 200);

  delete process.env.SODEX_TESTNET_SUBMIT_ENABLED;
  delete process.env.SODEX_TESTNET_SIGN_MODE;
  delete process.env.SODEX_TESTNET_API_KEY;
  delete process.env.SODEX_TESTNET_PRIVATE_KEY;
  delete process.env.SODEX_TESTNET_ACCOUNT_ID;
  delete process.env.SODEX_TESTNET_SUBMIT_URL;
});

test("master sign mode omits X-API-Key and can still submit", async () => {
  process.env.SODEX_TESTNET_SUBMIT_ENABLED = "true";
  process.env.SODEX_TESTNET_SIGN_MODE = "master";
  delete process.env.SODEX_TESTNET_API_KEY;
  process.env.SODEX_TESTNET_PRIVATE_KEY = "0x2222222222222222222222222222222222222222222222222222222222222222";
  process.env.SODEX_TESTNET_ACCOUNT_ID = "12345";
  process.env.SODEX_TESTNET_SUBMIT_URL = "https://sodex.testnet.example/api/v1/perps/trade/orders";

  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("markets/tickers")) {
      return new Response(JSON.stringify({ code: 0, data: [{ markPrice: "100000" }] }), { status: 200 });
    }
    if (url.includes("trade/orders")) {
      const headers = init?.headers as Record<string, string>;
      assert.equal(headers["X-API-Key"], undefined);
      assert.match(String(headers["X-API-Sign"]), /^0x01/);
      return new Response(JSON.stringify({ code: 0, data: [{ code: 0, clOrdID: "pg-master", orderID: 42 }] }), { status: 200 });
    }
    return new Response("not found", { status: 404 });
  };

  const execution = await attachSodexExecution({
    order: base,
    market,
    verdict: "APPROVE",
    approvedNotionalUsd: 1000,
    fetchImpl: fetchImpl as typeof fetch,
  });
  assert.equal(execution.status, "submitted");
  assert.equal(execution.sodexOrderId, "42");

  delete process.env.SODEX_TESTNET_SUBMIT_ENABLED;
  delete process.env.SODEX_TESTNET_SIGN_MODE;
  delete process.env.SODEX_TESTNET_PRIVATE_KEY;
  delete process.env.SODEX_TESTNET_ACCOUNT_ID;
  delete process.env.SODEX_TESTNET_SUBMIT_URL;
});

test("rejected policy blocks prepare and submit", async () => {
  const execution = await attachSodexExecution({
    order: base,
    market,
    verdict: "REJECT",
    approvedNotionalUsd: 0,
  });
  assert.equal(execution.status, "blocked");
  assert.equal(execution.preparedOrder, null);
  assert.equal(execution.submitAttempted, false);
});

test("REQUIRE_CONFIRMATION prepares but does not submit until confirmSubmit", async () => {
  process.env.SODEX_TESTNET_SUBMIT_ENABLED = "true";
  process.env.SODEX_TESTNET_API_KEY = "api-key-01";
  process.env.SODEX_TESTNET_PRIVATE_KEY = "0x2222222222222222222222222222222222222222222222222222222222222222";
  process.env.SODEX_TESTNET_ACCOUNT_ID = "12345";

  const unconfirmed = await attachSodexExecution({
    order: { ...base, userPolicy: { ...base.userPolicy, requireHumanConfirmation: true } },
    market,
    verdict: "REQUIRE_CONFIRMATION",
    approvedNotionalUsd: 750,
    confirmSubmit: false,
  });
  assert.equal(unconfirmed.status, "prepared");
  assert.equal(unconfirmed.submitAttempted, false);
  assert.match(unconfirmed.reason, /confirmSubmit/i);

  delete process.env.SODEX_TESTNET_SUBMIT_ENABLED;
  delete process.env.SODEX_TESTNET_API_KEY;
  delete process.env.SODEX_TESTNET_PRIVATE_KEY;
  delete process.env.SODEX_TESTNET_ACCOUNT_ID;
});
