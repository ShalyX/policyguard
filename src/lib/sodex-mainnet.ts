import { createHmac, timingSafeEqual } from "node:crypto";
import { keccak256, recoverTypedDataAddress, toHex, type Hex } from "viem";
import type { AssetSymbol, TradeSide } from "./types";
import { SODEX_MAINNET_CHAIN_ID, SODEX_ZERO_ADDRESS } from "./sodex-builder";

export const SODEX_MAINNET_PERPS_URL = "https://mainnet-gw.sodex.dev/api/v1/perps";

const SYMBOL_ID: Record<AssetSymbol, number> = { BTC: 1, ETH: 2, SOL: 4 };
const SYMBOL_NAME: Record<AssetSymbol, string> = { BTC: "BTC-USD", ETH: "ETH-USD", SOL: "SOL-USD" };

export type MainnetBuilder = { id: number; fee: number };
export type MainnetOrderParams = {
  accountID: number;
  symbolID: number;
  orders: Array<Record<string, unknown>>;
  builder: MainnetBuilder;
};

type ExecutionTokenPayload = {
  version: 1;
  userAddress: Hex;
  decisionId: string;
  nonce: number;
  expiresAt: number;
  params: MainnetOrderParams;
};

function stripTrailingZeros(value: string): string {
  if (!value.includes(".")) return value;
  return value.replace(/\.?0+$/, "") || "0";
}

function formatFunds(notionalUsd: number): string {
  return stripTrailingZeros(Math.max(notionalUsd, 10).toFixed(2));
}

function formatQty(qty: number, precision: number): string {
  return stripTrailingZeros(Math.max(qty, 0).toFixed(precision));
}

function clientOrderId(): string {
  const raw = `pg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return raw.replace(/[^0-9a-zA-Z_-]/g, "").slice(0, 36);
}

export function buildMainnetMarketOrder(args: {
  accountID: number;
  asset: AssetSymbol;
  side: TradeSide;
  approvedNotionalUsd: number;
  markPrice: number;
  builder: MainnetBuilder;
}): {
  params: MainnetOrderParams;
  compactSigningJson: string;
  payloadHash: Hex;
  market: string;
  clientOrderId: string;
} {
  if (!Number.isSafeInteger(args.accountID) || args.accountID <= 0) throw new Error("invalid account ID");
  if (!Number.isFinite(args.approvedNotionalUsd) || args.approvedNotionalUsd <= 0) throw new Error("invalid approved notional");
  if (!Number.isFinite(args.markPrice) || args.markPrice <= 0) throw new Error("invalid mark price");
  if (!Number.isSafeInteger(args.builder.id) || args.builder.id <= 0) throw new Error("invalid builder ID");
  if (!Number.isSafeInteger(args.builder.fee) || args.builder.fee <= 0 || args.builder.fee > 200) {
    throw new Error("invalid Perps builder fee");
  }

  const clOrdID = clientOrderId();
  const order: Record<string, unknown> = {
    clOrdID,
    modifier: 1,
    side: args.side === "LONG" ? 1 : 2,
    type: 2,
    timeInForce: 3,
  };

  if (args.side === "LONG") {
    order.funds = formatFunds(args.approvedNotionalUsd);
  } else {
    const precision = args.asset === "BTC" ? 5 : args.asset === "ETH" ? 4 : 3;
    order.quantity = formatQty(args.approvedNotionalUsd / args.markPrice, precision);
  }
  order.reduceOnly = false;
  order.positionSide = 1;

  // Canonical key order matters to SoDEX. Builder must be last at batch level, id before fee.
  const params: MainnetOrderParams = {
    accountID: args.accountID,
    symbolID: SYMBOL_ID[args.asset],
    orders: [order],
    builder: { id: args.builder.id, fee: args.builder.fee },
  };
  const compactSigningJson = JSON.stringify({ type: "newOrder", params });
  const payloadHash = keccak256(toHex(compactSigningJson));
  return { params, compactSigningJson, payloadHash, market: SYMBOL_NAME[args.asset], clientOrderId: clOrdID };
}

export function buildTradeTypedData(payloadHash: Hex, nonce: number) {
  if (!Number.isSafeInteger(nonce) || nonce <= 0) throw new Error("invalid nonce");
  return {
    domain: {
      name: "futures" as const,
      version: "1" as const,
      chainId: SODEX_MAINNET_CHAIN_ID,
      verifyingContract: SODEX_ZERO_ADDRESS,
    },
    types: {
      ExchangeAction: [
        { name: "payloadHash", type: "bytes32" },
        { name: "nonce", type: "uint64" },
      ],
    },
    primaryType: "ExchangeAction" as const,
    message: { payloadHash, nonce: BigInt(nonce) },
  };
}

export function serializeTradeTypedData(payloadHash: Hex, nonce: number) {
  return {
    domain: {
      name: "futures",
      version: "1",
      chainId: SODEX_MAINNET_CHAIN_ID,
      verifyingContract: SODEX_ZERO_ADDRESS,
    },
    primaryType: "ExchangeAction",
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" },
      ],
      ExchangeAction: [
        { name: "payloadHash", type: "bytes32" },
        { name: "nonce", type: "uint64" },
      ],
    },
    message: { payloadHash, nonce: String(nonce) },
  };
}

function signTokenBody(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

export function createExecutionToken(payload: ExecutionTokenPayload, secret: string): string {
  if (secret.length < 32) throw new Error("POLICYGUARD_EXECUTION_SECRET must be at least 32 characters");
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${signTokenBody(body, secret)}`;
}

export function verifyExecutionToken(token: string, secret: string, now = Date.now()): ExecutionTokenPayload {
  if (secret.length < 32) throw new Error("POLICYGUARD_EXECUTION_SECRET must be at least 32 characters");
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra) throw new Error("invalid execution token");
  const expected = signTokenBody(body, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("invalid execution token signature");

  const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as ExecutionTokenPayload;
  if (parsed.version !== 1 || parsed.expiresAt < now) throw new Error("execution token expired");
  if (!/^0x[0-9a-fA-F]{40}$/.test(parsed.userAddress)) throw new Error("invalid token user address");
  return parsed;
}

export function toSodexTradeSignature(signature: Hex): Hex {
  const raw = signature.slice(2);
  if (!/^[0-9a-fA-F]{130}$/.test(raw)) throw new Error("invalid 65-byte EVM signature");
  const r = raw.slice(0, 64);
  const s = raw.slice(64, 128);
  let v = Number.parseInt(raw.slice(128, 130), 16);
  if (v === 27 || v === 28) v -= 27;
  if (v !== 0 && v !== 1) throw new Error("invalid recovery byte");
  return `0x01${r}${s}${v.toString(16).padStart(2, "0")}` as Hex;
}

export async function recoverTradeSigner(args: { payloadHash: Hex; nonce: number; signature: Hex }): Promise<Hex> {
  const recovered = await recoverTypedDataAddress({ ...buildTradeTypedData(args.payloadHash, args.nonce), signature: args.signature });
  return recovered as Hex;
}

export function payloadHashForParams(params: MainnetOrderParams): Hex {
  return keccak256(toHex(JSON.stringify({ type: "newOrder", params })));
}
