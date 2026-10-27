import test from "node:test";
import assert from "node:assert/strict";
import { privateKeyToAccount } from "viem/accounts";
import {
  buildMainnetMarketOrder,
  buildTradeTypedData,
  createExecutionToken,
  payloadHashForParams,
  recoverTradeSigner,
  toSodexTradeSignature,
  verifyExecutionToken,
} from "../src/lib/sodex-mainnet";

test("mainnet market order keeps builder last and hashes the exact canonical payload", () => {
  const prepared = buildMainnetMarketOrder({
    accountID: 12345,
    asset: "BTC",
    side: "LONG",
    approvedNotionalUsd: 100,
    markPrice: 100000,
    builder: { id: 456, fee: 10 },
  });

  assert.equal(prepared.params.accountID, 12345);
  assert.deepEqual(prepared.params.builder, { id: 456, fee: 10 });
  assert.equal(prepared.params.orders[0].funds, "100");
  assert.match(prepared.compactSigningJson, /"orders":\[.*\],"builder":\{"id":456,"fee":10\}\}\}$/);
  assert.equal(payloadHashForParams(prepared.params), prepared.payloadHash);
});

test("execution token rejects tampering and expiry", () => {
  const secret = "0123456789abcdef0123456789abcdef";
  const prepared = buildMainnetMarketOrder({
    accountID: 12345,
    asset: "ETH",
    side: "SHORT",
    approvedNotionalUsd: 50,
    markPrice: 2500,
    builder: { id: 456, fee: 10 },
  });
  const token = createExecutionToken(
    {
      version: 1,
      userAddress: "0x1111111111111111111111111111111111111111",
      decisionId: "decision-1",
      nonce: 1760373925001,
      expiresAt: 1760373985001,
      params: prepared.params,
    },
    secret,
  );

  const decoded = verifyExecutionToken(token, secret, 1760373926000);
  assert.equal(decoded.params.builder.id, 456);
  assert.throws(() => verifyExecutionToken(`${token}x`, secret, 1760373926000), /invalid execution token/);
  assert.throws(() => verifyExecutionToken(token, secret, 1760373990000), /expired/);
});

test("trade typed data recovers the signing wallet and SoDEX signature gets 0x01 prefix", async () => {
  const pk = "0x2222222222222222222222222222222222222222222222222222222222222222" as const;
  const account = privateKeyToAccount(pk);
  const prepared = buildMainnetMarketOrder({
    accountID: 12345,
    asset: "SOL",
    side: "LONG",
    approvedNotionalUsd: 25,
    markPrice: 150,
    builder: { id: 456, fee: 10 },
  });
  const nonce = 1760373925001;
  const signature = await account.signTypedData(buildTradeTypedData(prepared.payloadHash, nonce));
  const recovered = await recoverTradeSigner({ payloadHash: prepared.payloadHash, nonce, signature });

  assert.equal(recovered.toLowerCase(), account.address.toLowerCase());
  assert.match(toSodexTradeSignature(signature), /^0x01[0-9a-f]{130}$/i);
});
