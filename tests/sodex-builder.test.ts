import test from "node:test";
import assert from "node:assert/strict";
import type { Hex } from "viem";
import {
  buildApproveBuilderFeeTypedData,
  checkBuilderEligibility,
  queryBuilderApprovals,
  resolvePrimaryAccountID,
  SODEX_MAINNET_CHAIN_ID,
  toSodexUniversalSignature,
} from "../src/lib/sodex-builder";

const address = "0x1111111111111111111111111111111111111111" as Hex;

test("buildApproveBuilderFeeTypedData uses mainnet universal domain and exact field order", () => {
  const typed = buildApproveBuilderFeeTypedData({
    userAccountID: 1010,
    builderID: 456,
    maxFeeRate: 10,
    nonce: 1760373925000,
  });

  assert.equal(typed.domain.name, "universal");
  assert.equal(typed.domain.chainId, SODEX_MAINNET_CHAIN_ID);
  assert.equal(typed.primaryType, "ApproveBuilderFeeAction");
  assert.deepEqual(
    typed.types.ApproveBuilderFeeAction.map((field) => field.name),
    ["chainID", "nonce", "accountID", "builderID", "maxFeeRate"],
  );
  assert.equal(typed.message.chainID, BigInt(286623));
  assert.equal(typed.message.accountID, BigInt(1010));
  assert.equal(typed.message.builderID, BigInt(456));
  assert.equal(typed.message.maxFeeRate, BigInt(10));
});

test("toSodexUniversalSignature adds 0x02 and normalizes v", () => {
  const raw = (`0x${"11".repeat(32)}${"22".repeat(32)}1b`) as Hex;
  const encoded = toSodexUniversalSignature(raw);
  assert.match(encoded, /^0x02[0-9a-f]{130}$/i);
  assert.equal(encoded.slice(-2), "00");
});

test("resolvePrimaryAccountID reads data.primaryAccountID", async () => {
  const fetchImpl = async () =>
    new Response(JSON.stringify({ code: 0, data: { primaryAccountID: 98765, subaccounts: [] } }), { status: 200 });
  const accountID = await resolvePrimaryAccountID(address, fetchImpl as typeof fetch);
  assert.equal(accountID, 98765);
});

test("checkBuilderEligibility requires at least 100 vUSDC in both engines", async () => {
  const fetchImpl = async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/subaccounts")) {
      return new Response(JSON.stringify({ code: 0, data: { primaryAccountID: 456 } }), { status: 200 });
    }
    if (url.includes("/spot/")) {
      return new Response(JSON.stringify({ code: 0, data: [{ coin: "vUSDC", total: "120.5" }] }), { status: 200 });
    }
    if (url.includes("/perps/")) {
      return new Response(JSON.stringify({ code: 0, data: [{ coin: "vUSDC", total: "100" }] }), { status: 200 });
    }
    return new Response("not found", { status: 404 });
  };

  const eligibility = await checkBuilderEligibility(address, fetchImpl as typeof fetch);
  assert.equal(eligibility.accountID, 456);
  assert.equal(eligibility.spotVusdc, 120.5);
  assert.equal(eligibility.perpsVusdc, 100);
  assert.equal(eligibility.eligible, true);
});

test("queryBuilderApprovals returns spot and perps approvals", async () => {
  const fetchImpl = async () =>
    new Response(
      JSON.stringify({
        code: 0,
        data: {
          spot: [{ builderID: 456, feeRate: 10 }],
          perps: [{ builderID: 456, feeRate: 10 }],
        },
      }),
      { status: 200 },
    );

  const approvals = await queryBuilderApprovals(address, fetchImpl as typeof fetch);
  assert.deepEqual(approvals, {
    spot: [{ builderID: 456, feeRate: 10 }],
    perps: [{ builderID: 456, feeRate: 10 }],
  });
});
