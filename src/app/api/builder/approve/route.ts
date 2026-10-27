import { NextRequest, NextResponse } from "next/server";
import type { Hex } from "viem";
import { SODEX_MAINNET_CHAIN_ID, SODEX_MAINNET_PUBLIC_URL } from "@/lib/sodex-builder";

function isAddress(value: unknown): value is Hex {
  return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value);
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isSignature(value: unknown): value is Hex {
  return typeof value === "string" && /^0x02[0-9a-fA-F]{130}$/.test(value);
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "invalid_json" }, { status: 400 });

  const { userAddress, accountID, builderID, maxFeeRate, nonce, signature } = body;
  if (!isAddress(userAddress)) return NextResponse.json({ error: "invalid_user_address" }, { status: 400 });
  if (!isPositiveInt(accountID)) return NextResponse.json({ error: "invalid_account_id" }, { status: 400 });
  if (!isPositiveInt(builderID)) return NextResponse.json({ error: "invalid_builder_id" }, { status: 400 });
  if (
    typeof maxFeeRate !== "number" ||
    !Number.isSafeInteger(maxFeeRate) ||
    maxFeeRate < 0 ||
    maxFeeRate > 200
  ) {
    return NextResponse.json({ error: "invalid_perps_builder_fee_rate" }, { status: 400 });
  }
  if (!isPositiveInt(nonce)) return NextResponse.json({ error: "invalid_nonce" }, { status: 400 });
  if (!isSignature(signature)) return NextResponse.json({ error: "invalid_signature" }, { status: 400 });

  const upstream = await fetch(`${SODEX_MAINNET_PUBLIC_URL}/user/${userAddress}/builders`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      "X-API-Chain": String(SODEX_MAINNET_CHAIN_ID),
      "X-API-Nonce": String(nonce),
      "X-API-Sign": signature,
    },
    body: JSON.stringify({ accountID, builderID, maxFeeRate }),
    cache: "no-store",
  });

  const text = await upstream.text();
  let responseBody: unknown = null;
  try {
    responseBody = text ? JSON.parse(text) : null;
  } catch {
    responseBody = { raw: text.slice(0, 500) };
  }

  return NextResponse.json(
    {
      ok: upstream.ok && Boolean(responseBody && typeof responseBody === "object" && (responseBody as Record<string, unknown>).code === 0),
      sodex: responseBody,
    },
    { status: upstream.ok ? 200 : upstream.status, headers: { "cache-control": "no-store" } },
  );
}
