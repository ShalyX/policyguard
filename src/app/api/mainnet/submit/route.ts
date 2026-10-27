import { NextRequest, NextResponse } from "next/server";
import type { Hex } from "viem";
import {
  checkBuilderEligibility,
  getBuilderConfig,
  queryBuilderApprovals,
  resolvePrimaryAccountID,
  SODEX_MAINNET_CHAIN_ID,
} from "@/lib/sodex-builder";
import {
  payloadHashForParams,
  recoverTradeSigner,
  SODEX_MAINNET_PERPS_URL,
  toSodexTradeSignature,
  verifyExecutionToken,
} from "@/lib/sodex-mainnet";

function isRawSignature(value: unknown): value is Hex {
  return typeof value === "string" && /^0x[0-9a-fA-F]{130}$/.test(value);
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "invalid_json" }, { status: 400 });

  const token = typeof body.executionToken === "string" ? body.executionToken : "";
  const signature = body.signature;
  if (!token) return NextResponse.json({ error: "missing_execution_token" }, { status: 400 });
  if (!isRawSignature(signature)) return NextResponse.json({ error: "invalid_wallet_signature" }, { status: 400 });

  const secret = process.env.POLICYGUARD_EXECUTION_SECRET?.trim() || "";
  let prepared: ReturnType<typeof verifyExecutionToken>;
  try {
    prepared = verifyExecutionToken(token, secret);
  } catch (error) {
    return NextResponse.json(
      { error: "invalid_execution_token", message: error instanceof Error ? error.message : "Invalid execution token." },
      { status: 400 },
    );
  }

  const builder = getBuilderConfig();
  if (!builder.address) return NextResponse.json({ error: "builder_not_configured" }, { status: 503 });

  const [builderEligibility, currentUserAccountID, approvals] = await Promise.all([
    checkBuilderEligibility(builder.address).catch(() => null),
    resolvePrimaryAccountID(prepared.userAddress).catch(() => null),
    queryBuilderApprovals(prepared.userAddress).catch(() => null),
  ]);

  if (!builderEligibility?.eligible || !builderEligibility.accountID) {
    return NextResponse.json({ error: "builder_not_eligible" }, { status: 503 });
  }
  if (prepared.params.builder.id !== builderEligibility.accountID || prepared.params.builder.fee !== builder.fee) {
    return NextResponse.json({ error: "builder_configuration_changed", message: "Prepare the trade again." }, { status: 409 });
  }
  if (!currentUserAccountID || currentUserAccountID !== prepared.params.accountID) {
    return NextResponse.json({ error: "account_mismatch", message: "The prepared order no longer matches this SoDEX account." }, { status: 409 });
  }

  const approved = Boolean(
    approvals?.perps.some((row) => row.builderID === builderEligibility.accountID && row.feeRate >= builder.fee),
  );
  if (!approved) {
    return NextResponse.json({ error: "builder_not_authorized", message: "PolicyGuard Builder approval is missing or too low." }, { status: 403 });
  }

  const payloadHash = payloadHashForParams(prepared.params);
  let recovered: Hex;
  try {
    recovered = await recoverTradeSigner({ payloadHash, nonce: prepared.nonce, signature });
  } catch {
    return NextResponse.json({ error: "signature_recovery_failed" }, { status: 400 });
  }
  if (recovered.toLowerCase() !== prepared.userAddress.toLowerCase()) {
    return NextResponse.json({ error: "wallet_signature_mismatch" }, { status: 403 });
  }

  let sodexSignature: Hex;
  try {
    sodexSignature = toSodexTradeSignature(signature);
  } catch (error) {
    return NextResponse.json(
      { error: "invalid_wallet_signature", message: error instanceof Error ? error.message : "Invalid wallet signature." },
      { status: 400 },
    );
  }

  const upstream = await fetch(`${SODEX_MAINNET_PERPS_URL}/trade/orders`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      "X-API-Sign": sodexSignature,
      "X-API-Nonce": String(prepared.nonce),
      "X-API-Chain": String(SODEX_MAINNET_CHAIN_ID),
    },
    body: JSON.stringify(prepared.params),
    cache: "no-store",
  });

  const text = await upstream.text();
  let sodex: unknown = null;
  try {
    sodex = text ? JSON.parse(text) : null;
  } catch {
    sodex = { raw: text.slice(0, 800) };
  }

  const responseCode =
    sodex && typeof sodex === "object" && "code" in sodex && typeof (sodex as { code?: unknown }).code === "number"
      ? (sodex as { code: number }).code
      : null;
  const ok = upstream.ok && responseCode === 0;

  return NextResponse.json(
    {
      ok,
      venue: "SoDEX mainnet",
      decisionId: prepared.decisionId,
      accountID: prepared.params.accountID,
      builder: prepared.params.builder,
      payloadHash,
      sodex,
    },
    { status: upstream.ok ? 200 : upstream.status, headers: { "cache-control": "no-store" } },
  );
}
