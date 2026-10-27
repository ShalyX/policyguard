import type { Hex } from "viem";

export const SODEX_MAINNET_CHAIN_ID = 286623;
export const SODEX_MAINNET_PUBLIC_URL = "https://mainnet-gw.sodex.dev/api/v1";
export const SODEX_ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

export type BuilderApproval = {
  builderID: number;
  feeRate: number;
};

export type BuilderEligibility = {
  address: Hex;
  accountID: number | null;
  spotVusdc: number | null;
  perpsVusdc: number | null;
  eligible: boolean;
};

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : null;
}

function asPositiveInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

function numberish(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function findVusdcBalance(payload: unknown): number | null {
  const root = asObject(payload);
  const data = root ? (root.data ?? root) : payload;
  const dataObj = asObject(data);
  const candidates = [
    dataObj?.balances,
    dataObj?.B,
    dataObj?.balance,
    data,
  ];

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;
    for (const item of candidate) {
      const row = asObject(item);
      if (!row) continue;
      const symbol = String(row.coin ?? row.asset ?? row.a ?? row.symbol ?? "").toUpperCase();
      if (symbol !== "VUSDC" && symbol !== "USDC") continue;
      const value = row.total ?? row.walletBalance ?? row.wb ?? row.available ?? row.balance ?? row.t;
      const parsed = numberish(value);
      if (parsed !== null) return parsed;
    }
  }
  return null;
}

export function getBuilderConfig() {
  const address = process.env.SODEX_BUILDER_ADDRESS?.trim();
  const feeRaw = process.env.SODEX_BUILDER_FEE_RATE?.trim() || "10";
  const fee = /^\d+$/.test(feeRaw) ? Number(feeRaw) : NaN;
  return {
    address: address && /^0x[0-9a-fA-F]{40}$/.test(address) ? (address as Hex) : null,
    fee: Number.isSafeInteger(fee) && fee > 0 && fee <= 200 ? fee : 10,
  };
}

export async function resolvePrimaryAccountID(
  address: Hex,
  fetchImpl: typeof fetch = fetch,
): Promise<number | null> {
  const res = await fetchImpl(`${SODEX_MAINNET_PUBLIC_URL}/user/${address}/subaccounts`, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = (await res.json()) as JsonObject;
  if (json.code !== undefined && json.code !== 0) return null;
  const data = asObject(json.data);
  return asPositiveInt(data?.primaryAccountID);
}

export async function checkBuilderEligibility(
  address: Hex,
  fetchImpl: typeof fetch = fetch,
): Promise<BuilderEligibility> {
  const accountID = await resolvePrimaryAccountID(address, fetchImpl);
  if (!accountID) {
    return { address, accountID: null, spotVusdc: null, perpsVusdc: null, eligible: false };
  }

  const qs = `accountID=${encodeURIComponent(String(accountID))}`;
  const [spotRes, perpsRes] = await Promise.all([
    fetchImpl(`https://mainnet-gw.sodex.dev/api/v1/spot/accounts/${address}/balances?${qs}`, {
      headers: { accept: "application/json" },
      cache: "no-store",
    }),
    fetchImpl(`https://mainnet-gw.sodex.dev/api/v1/perps/accounts/${address}/balances?${qs}`, {
      headers: { accept: "application/json" },
      cache: "no-store",
    }),
  ]);

  const spotJson = spotRes.ok ? await spotRes.json() : null;
  const perpsJson = perpsRes.ok ? await perpsRes.json() : null;
  const spotVusdc = findVusdcBalance(spotJson);
  const perpsVusdc = findVusdcBalance(perpsJson);

  return {
    address,
    accountID,
    spotVusdc,
    perpsVusdc,
    eligible: spotVusdc !== null && perpsVusdc !== null && spotVusdc >= 100 && perpsVusdc >= 100,
  };
}

export async function queryBuilderApprovals(
  userAddress: Hex,
  fetchImpl: typeof fetch = fetch,
): Promise<{ spot: BuilderApproval[]; perps: BuilderApproval[] } | null> {
  const res = await fetchImpl(`${SODEX_MAINNET_PUBLIC_URL}/user/${userAddress}/builders`, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = (await res.json()) as JsonObject;
  if (json.code !== undefined && json.code !== 0) return null;
  const data = asObject(json.data);

  const parse = (value: unknown): BuilderApproval[] => {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
      const row = asObject(item);
      const builderID = asPositiveInt(row?.builderID);
      const feeRate = numberish(row?.feeRate);
      return builderID && feeRate !== null ? [{ builderID, feeRate }] : [];
    });
  };

  return { spot: parse(data?.spot), perps: parse(data?.perps) };
}

export function buildApproveBuilderFeeTypedData(args: {
  userAccountID: number;
  builderID: number;
  maxFeeRate: number;
  nonce: number;
}) {
  if (!Number.isSafeInteger(args.userAccountID) || args.userAccountID <= 0) throw new Error("invalid user account ID");
  if (!Number.isSafeInteger(args.builderID) || args.builderID <= 0) throw new Error("invalid builder ID");
  if (!Number.isSafeInteger(args.maxFeeRate) || args.maxFeeRate < 0 || args.maxFeeRate > 2000) {
    throw new Error("invalid builder max fee rate");
  }

  return {
    domain: {
      name: "universal" as const,
      version: "1" as const,
      chainId: SODEX_MAINNET_CHAIN_ID,
      verifyingContract: SODEX_ZERO_ADDRESS,
    },
    types: {
      ApproveBuilderFeeAction: [
        { name: "chainID", type: "uint64" },
        { name: "nonce", type: "uint64" },
        { name: "accountID", type: "uint64" },
        { name: "builderID", type: "uint64" },
        { name: "maxFeeRate", type: "uint64" },
      ],
    },
    primaryType: "ApproveBuilderFeeAction" as const,
    message: {
      chainID: BigInt(SODEX_MAINNET_CHAIN_ID),
      nonce: BigInt(args.nonce),
      accountID: BigInt(args.userAccountID),
      builderID: BigInt(args.builderID),
      maxFeeRate: BigInt(args.maxFeeRate),
    },
  };
}

export function toSodexUniversalSignature(signature: Hex): Hex {
  const raw = signature.slice(2);
  if (!/^[0-9a-fA-F]{130}$/.test(raw)) throw new Error("invalid 65-byte EVM signature");
  const r = raw.slice(0, 64);
  const s = raw.slice(64, 128);
  let v = Number.parseInt(raw.slice(128, 130), 16);
  if (v === 27 || v === 28) v -= 27;
  if (v !== 0 && v !== 1) throw new Error("invalid recovery byte");
  return `0x02${r}${s}${v.toString(16).padStart(2, "0")}` as Hex;
}
