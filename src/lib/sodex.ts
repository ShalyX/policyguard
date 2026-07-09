import { keccak256, stringToBytes, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { AssetSymbol, ExecutionRecord, MarketEvidence, ProposedOrder, TradeSide, Verdict } from "./types";

const TESTNET_BASE = "https://testnet-gw.sodex.dev/api/v1/perps";
const TESTNET_CHAIN_ID = 138565;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

const SYMBOL_ID: Record<AssetSymbol, number> = {
  BTC: 1,
  ETH: 2,
  SOL: 4,
};

const SYMBOL_NAME: Record<AssetSymbol, string> = {
  BTC: "BTC-USD",
  ETH: "ETH-USD",
  SOL: "SOL-USD",
};

type JsonObject = Record<string, unknown>;

export type SodexConfig = {
  submitEnabled: boolean;
  baseUrl: string;
  submitUrl: string;
  chainId: number;
  domain: "futures";
  apiKeyName: string | null;
  privateKey: Hex | null;
  accountId: number | null;
  masterAddress: string | null;
  /** api_key = send X-API-Key name; master = omit header and sign with master wallet private key */
  signMode: "api_key" | "master";
  credentialsConfigured: boolean;
};

function env(name: string): string | undefined {
  const value = process.env[name];
  if (!value) return undefined;
  // strip trailing inline comments: VALUE   # note
  const cleaned = value.replace(/\s+#.*$/, "").trim().replace(/^["']|["']$/g, "");
  return cleaned || undefined;
}

function isAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value);
}

function normalizePrivateKey(raw: string | undefined): Hex | null {
  if (!raw) return null;
  const candidate = raw.startsWith("0x") ? raw : `0x${raw}`;
  return /^0x[0-9a-fA-F]{64}$/.test(candidate) ? (candidate as Hex) : null;
}

function normalizeApiKeyName(raw: string | undefined): string | null {
  if (!raw) return null;
  // X-API-Key must be the key *name*, not an EVM address.
  if (isAddress(raw)) return null;
  return /^[0-9a-zA-Z_-]{1,36}$/.test(raw) ? raw : null;
}

export function getSodexConfig(): SodexConfig {
  const baseUrl = env("SODEX_TESTNET_BASE_URL") || TESTNET_BASE;
  const submitUrl = env("SODEX_TESTNET_SUBMIT_URL") || `${baseUrl.replace(/\/$/, "")}/trade/orders`;
  const apiKeyName = normalizeApiKeyName(env("SODEX_TESTNET_API_KEY") || env("SODEX_API_KEY"));
  const privateKey = normalizePrivateKey(env("SODEX_TESTNET_PRIVATE_KEY"));
  const accountIdRaw = env("SODEX_TESTNET_ACCOUNT_ID");
  const accountId: number | null = accountIdRaw && /^\d+$/.test(accountIdRaw) ? Number(accountIdRaw) : null;
  let masterAddress = env("SODEX_TESTNET_MASTER_ADDRESS") || null;
  // Common wiring mistake: paste wallet address into ACCOUNT_ID.
  if (!accountId && accountIdRaw && isAddress(accountIdRaw)) {
    masterAddress = masterAddress || accountIdRaw;
  }
  if (masterAddress && !isAddress(masterAddress)) masterAddress = null;
  const chainId = Number(env("SODEX_TESTNET_CHAIN_ID") || TESTNET_CHAIN_ID);
  const submitEnabled = env("SODEX_TESTNET_SUBMIT_ENABLED") === "true";
  const signModeEnv = (env("SODEX_TESTNET_SIGN_MODE") || "").toLowerCase();
  // SoDEX docs: omit X-API-Key to sign with master wallet ("default key").
  // Use master when explicitly set, or when no valid API key name is configured.
  const signMode: "api_key" | "master" =
    signModeEnv === "master" || (!apiKeyName && signModeEnv !== "api_key")
      ? "master"
      : apiKeyName
        ? "api_key"
        : "master";

  return {
    submitEnabled,
    baseUrl,
    submitUrl,
    chainId: Number.isFinite(chainId) ? chainId : TESTNET_CHAIN_ID,
    domain: "futures",
    apiKeyName,
    privateKey,
    accountId,
    masterAddress,
    signMode,
    // accountId may resolve later from masterAddress via /accounts/{addr}/state
    credentialsConfigured: Boolean(privateKey && (accountId !== null || masterAddress) && (signMode === "master" || apiKeyName)),
  };
}

export function sodexHealth() {
  const cfg = getSodexConfig();
  return {
    submitEnabled: cfg.submitEnabled,
    credentialsConfigured: cfg.credentialsConfigured,
    submitUrlConfigured: Boolean(cfg.submitUrl),
    accountIdConfigured: cfg.accountId !== null,
    apiKeyNameConfigured: Boolean(cfg.apiKeyName),
    privateKeyConfigured: Boolean(cfg.privateKey),
    masterAddressConfigured: Boolean(cfg.masterAddress),
    signMode: cfg.signMode,
    chainId: cfg.chainId,
    domain: cfg.domain,
  };
}

function stripTrailingZeros(value: string): string {
  if (!value.includes(".")) return value;
  return value.replace(/\.?0+$/, "") || "0";
}

function formatFunds(notionalUsd: number): string {
  return stripTrailingZeros(Math.max(notionalUsd, 10).toFixed(2));
}

function formatQty(qty: number, precision: number): string {
  const fixed = Math.max(qty, 0).toFixed(precision);
  return stripTrailingZeros(fixed);
}

function clientOrderId(prefix: string): string {
  const raw = `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return raw.replace(/[^0-9a-zA-Z_-]/g, "").slice(0, 36);
}

function toSodexSignature(sig: Hex): Hex {
  const raw = sig.slice(2);
  const r = raw.slice(0, 64);
  const s = raw.slice(64, 128);
  let v = Number.parseInt(raw.slice(128, 130), 16);
  if (v === 27 || v === 28) v -= 27;
  return `0x01${r}${s}${v.toString(16).padStart(2, "0")}` as Hex;
}

/** Compact JSON with explicit key order matching SoDEX Go struct field order. */
export function buildNewOrderSigningPayload(params: {
  accountID: number;
  symbolID: number;
  clOrdID: string;
  side: 1 | 2;
  type: 1 | 2;
  timeInForce: 1 | 2 | 3 | 4;
  funds?: string;
  quantity?: string;
  reduceOnly?: boolean;
  positionSide?: 1;
}): { signingPayload: { type: "newOrder"; params: JsonObject }; httpBody: JsonObject; compactSigningJson: string } {
  const order: JsonObject = {
    clOrdID: params.clOrdID,
    modifier: 1,
    side: params.side,
    type: params.type,
    timeInForce: params.timeInForce,
  };
  if (params.funds !== undefined) order.funds = params.funds;
  if (params.quantity !== undefined) order.quantity = params.quantity;
  order.reduceOnly = params.reduceOnly ?? false;
  order.positionSide = params.positionSide ?? 1;

  const httpBody: JsonObject = {
    accountID: params.accountID,
    symbolID: params.symbolID,
    orders: [order],
  };
  const signingPayload = { type: "newOrder" as const, params: httpBody };
  // Explicit compact marshal — field order above must stay stable.
  const compactSigningJson = JSON.stringify(signingPayload);
  return { signingPayload, httpBody, compactSigningJson };
}

export async function signExchangeAction(args: {
  privateKey: Hex;
  chainId: number;
  domainName: "futures" | "spot";
  compactSigningJson: string;
  nonce: number;
}): Promise<{ payloadHash: Hex; signature: Hex; nonce: number }> {
  const account = privateKeyToAccount(args.privateKey);
  const payloadHash = keccak256(stringToBytes(args.compactSigningJson));
  const signature = await account.signTypedData({
    domain: {
      name: args.domainName,
      version: "1",
      chainId: args.chainId,
      verifyingContract: ZERO_ADDRESS,
    },
    types: {
      ExchangeAction: [
        { name: "payloadHash", type: "bytes32" },
        { name: "nonce", type: "uint64" },
      ],
    },
    primaryType: "ExchangeAction",
    message: {
      payloadHash,
      nonce: BigInt(args.nonce),
    },
  });
  return { payloadHash, signature: toSodexSignature(signature), nonce: args.nonce };
}

async function resolveAccountId(cfg: SodexConfig): Promise<number | null> {
  if (cfg.accountId !== null) return cfg.accountId;
  if (!cfg.masterAddress) return null;
  try {
    const url = `${cfg.baseUrl.replace(/\/$/, "")}/accounts/${cfg.masterAddress}/state`;
    const res = await fetch(url, { headers: { accept: "application/json" }, cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as JsonObject;
    const data = (json.data ?? json) as JsonObject;
    const aid = data.aid ?? data.accountID ?? data.accountId;
    if (typeof aid === "number") return aid;
    if (typeof aid === "string" && /^\d+$/.test(aid)) return Number(aid);
    return null;
  } catch {
    return null;
  }
}

async function resolveMarkPrice(asset: AssetSymbol, cfg: SodexConfig, fallback: number): Promise<number> {
  try {
    const symbol = SYMBOL_NAME[asset];
    const url = `${cfg.baseUrl.replace(/\/$/, "")}/markets/tickers?symbol=${encodeURIComponent(symbol)}`;
    const res = await fetch(url, { headers: { accept: "application/json" }, cache: "no-store" });
    if (!res.ok) return fallback;
    const json = (await res.json()) as JsonObject;
    const data = Array.isArray(json.data) ? (json.data[0] as JsonObject | undefined) : undefined;
    const mark = Number(data?.markPrice ?? data?.lastPx ?? fallback);
    return Number.isFinite(mark) && mark > 0 ? mark : fallback;
  } catch {
    return fallback;
  }
}

function sideToOrderSide(side: TradeSide): 1 | 2 {
  return side === "LONG" ? 1 : 2;
}

function canAutoSubmit(verdict: Verdict, confirmSubmit: boolean, requireHumanConfirmation: boolean): boolean {
  if (verdict === "REJECT") return false;
  if (verdict === "REQUIRE_CONFIRMATION" || requireHumanConfirmation) return confirmSubmit;
  if (verdict === "APPROVE" || verdict === "REDUCE_SIZE") return true;
  return false;
}

export async function attachSodexExecution(args: {
  order: ProposedOrder;
  market: MarketEvidence;
  verdict: Verdict;
  approvedNotionalUsd: number;
  confirmSubmit?: boolean;
  fetchImpl?: typeof fetch;
}): Promise<ExecutionRecord> {
  const cfg = getSodexConfig();
  const fetchFn = args.fetchImpl ?? fetch;
  const canPrepare = args.verdict !== "REJECT" && args.approvedNotionalUsd > 0;

  if (!canPrepare) {
    return {
      status: "blocked",
      venue: "SoDEX testnet",
      reason: "Policy rejected this order; no SoDEX order is prepared or submitted.",
      preparedOrder: null,
      orderId: null,
      sodexOrderId: null,
      payloadHash: null,
      submitAttempted: false,
      submitHttpStatus: null,
      responseSnippet: null,
    };
  }

  const clOrdID = clientOrderId("pg");
  const symbolID = SYMBOL_ID[args.order.asset];
  const markPrice = await resolveMarkPrice(args.order.asset, cfg, args.market.price);
  const accountID = (await resolveAccountId(cfg)) ?? cfg.accountId ?? 0;

  const orderSide = sideToOrderSide(args.order.side);
  let funds: string | undefined;
  let quantity: string | undefined;
  if (args.order.side === "LONG") {
    funds = formatFunds(args.approvedNotionalUsd);
  } else {
    const precision = args.order.asset === "BTC" ? 5 : args.order.asset === "ETH" ? 4 : 3;
    quantity = formatQty(args.approvedNotionalUsd / markPrice, precision);
  }

  const { httpBody, compactSigningJson } = buildNewOrderSigningPayload({
    accountID: accountID || 0,
    symbolID,
    clOrdID,
    side: orderSide,
    type: 2,
    timeInForce: 3,
    funds,
    quantity,
    reduceOnly: false,
    positionSide: 1,
  });

  const preparedOrder = {
    market: SYMBOL_NAME[args.order.asset],
    symbolID,
    side: args.order.side,
    notionalUsd: args.approvedNotionalUsd,
    leverage: args.order.leverage,
    reduceOnly: false,
    clientOrderId: clOrdID,
    accountID: accountID || null,
    markPrice,
    orderType: "MARKET" as const,
    timeInForce: "IOC" as const,
    funds: funds ?? null,
    quantity: quantity ?? null,
    httpBody,
    signingType: "newOrder" as const,
    submitUrl: cfg.submitUrl,
    chainId: cfg.chainId,
    domain: cfg.domain,
  };

  const autoSubmit = canAutoSubmit(
    args.verdict,
    Boolean(args.confirmSubmit),
    args.order.userPolicy.requireHumanConfirmation,
  );

  if (!cfg.submitEnabled || !cfg.credentialsConfigured || !autoSubmit || !cfg.privateKey) {
    const missing: string[] = [];
    if (!cfg.submitEnabled) missing.push("SODEX_TESTNET_SUBMIT_ENABLED=true");
    if (!cfg.privateKey) missing.push("SODEX_TESTNET_PRIVATE_KEY");
    if (cfg.signMode === "api_key" && !cfg.apiKeyName) missing.push("SODEX_TESTNET_API_KEY (or set SODEX_TESTNET_SIGN_MODE=master)");
    if (cfg.accountId === null && !cfg.masterAddress) missing.push("SODEX_TESTNET_ACCOUNT_ID or SODEX_TESTNET_MASTER_ADDRESS");
    if (!autoSubmit) missing.push("human confirmation (set confirmSubmit:true)");

    return {
      status: "prepared",
      venue: "SoDEX testnet",
      reason: autoSubmit
        ? `Order prepared for SoDEX testnet. Submission blocked until: ${missing.join(", ")}.`
        : `Order prepared for SoDEX testnet. Policy requires confirmation before submit (${args.verdict}). Re-run with confirmSubmit:true to submit.`,
      preparedOrder,
      orderId: clOrdID,
      sodexOrderId: null,
      payloadHash: keccak256(stringToBytes(compactSigningJson)),
      submitAttempted: false,
      submitHttpStatus: null,
      responseSnippet: null,
    };
  }

  if (!accountID) {
    return {
      status: "prepared",
      venue: "SoDEX testnet",
      reason: "Credentials present but accountID could not be resolved; order kept prepared.",
      preparedOrder,
      orderId: clOrdID,
      sodexOrderId: null,
      payloadHash: keccak256(stringToBytes(compactSigningJson)),
      submitAttempted: false,
      submitHttpStatus: null,
      responseSnippet: null,
    };
  }

  const nonce = Date.now();
  try {
    const signed = await signExchangeAction({
      privateKey: cfg.privateKey,
      chainId: cfg.chainId,
      domainName: cfg.domain,
      compactSigningJson,
      nonce,
    });

    const headers: Record<string, string> = {
      "content-type": "application/json",
      accept: "application/json",
      "X-API-Sign": signed.signature,
      "X-API-Nonce": String(signed.nonce),
      "X-API-Chain": String(cfg.chainId),
    };
    // Only send X-API-Key when using a registered API key name.
    // Omit for master-wallet ("default key") signing per SoDEX docs.
    if (cfg.signMode === "api_key" && cfg.apiKeyName) {
      headers["X-API-Key"] = cfg.apiKeyName;
    }

    const res = await fetchFn(cfg.submitUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(httpBody),
      cache: "no-store",
    });

    const text = await res.text();
    let json: JsonObject = {};
    try {
      json = text ? (JSON.parse(text) as JsonObject) : {};
    } catch {
      json = { raw: text.slice(0, 500) };
    }

    const code = typeof json.code === "number" ? json.code : res.ok ? 0 : -1;
    const data = json.data;
    let sodexOrderId: string | null = null;
    let orderLevelCode: number | null = null;
    let orderLevelError: string | null = null;
    if (Array.isArray(data) && data[0] && typeof data[0] === "object") {
      const row = data[0] as JsonObject;
      if (typeof row.code === "number") orderLevelCode = row.code;
      if (typeof row.error === "string") orderLevelError = row.error;
      if (row.orderID !== undefined && row.orderID !== null) sodexOrderId = String(row.orderID);
      else if (row.orderId !== undefined) sodexOrderId = String(row.orderId);
    } else if (data && typeof data === "object") {
      const row = data as JsonObject;
      if (typeof row.code === "number") orderLevelCode = row.code;
      if (typeof row.error === "string") orderLevelError = row.error;
      if (row.orderID !== undefined) sodexOrderId = String(row.orderID);
    }

    const orderOk = orderLevelCode === null ? true : orderLevelCode === 0;
    if (res.ok && code === 0 && orderOk) {
      return {
        status: "submitted",
        venue: "SoDEX testnet",
        reason: `Submitted signed market order to SoDEX testnet${sodexOrderId ? ` (orderID ${sodexOrderId})` : ""}.`,
        preparedOrder,
        orderId: clOrdID,
        sodexOrderId,
        payloadHash: signed.payloadHash,
        submitAttempted: true,
        submitHttpStatus: res.status,
        responseSnippet: text.slice(0, 800),
      };
    }

    const detail = orderLevelError
      ? ` order error: ${orderLevelError}`
      : code !== 0
        ? ` code=${code}`
        : orderLevelCode !== null && orderLevelCode !== 0
          ? ` order code=${orderLevelCode}`
          : "";

    return {
      status: "prepared",
      venue: "SoDEX testnet",
      reason: `SoDEX testnet submit returned HTTP ${res.status}${detail}; kept prepared for retry.`,
      preparedOrder,
      orderId: clOrdID,
      sodexOrderId: null,
      payloadHash: signed.payloadHash,
      submitAttempted: true,
      submitHttpStatus: res.status,
      responseSnippet: text.slice(0, 800),
    };
  } catch (error) {
    return {
      status: "prepared",
      venue: "SoDEX testnet",
      reason: `SoDEX testnet submit attempt failed (${error instanceof Error ? error.message : "error"}); kept prepared for retry.`,
      preparedOrder,
      orderId: clOrdID,
      sodexOrderId: null,
      payloadHash: keccak256(stringToBytes(compactSigningJson)),
      submitAttempted: true,
      submitHttpStatus: null,
      responseSnippet: null,
    };
  }
}
