import { NextRequest, NextResponse } from "next/server";
import type { Hex } from "viem";
import { preflightSchema } from "@/lib/request";
import { getMarketEvidence } from "@/lib/sosovalue";
import { evaluatePolicy } from "@/lib/policy";
import {
  checkBuilderEligibility,
  getBuilderConfig,
  queryBuilderApprovals,
  resolvePrimaryAccountID,
} from "@/lib/sodex-builder";
import {
  buildMainnetMarketOrder,
  createExecutionToken,
  serializeTradeTypedData,
} from "@/lib/sodex-mainnet";

function isAddress(value: unknown): value is Hex {
  return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value);
}

export async function POST(request: NextRequest) {
  const raw = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!raw) return NextResponse.json({ error: "invalid_json" }, { status: 400 });

  const userAddress = raw.userAddress;
  if (!isAddress(userAddress)) return NextResponse.json({ error: "invalid_user_address" }, { status: 400 });

  const { userAddress: _ignored, ...orderInput } = raw;
  const parsed = preflightSchema.safeParse(orderInput);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", issues: parsed.error.flatten() }, { status: 422 });
  }

  const secret = process.env.POLICYGUARD_EXECUTION_SECRET?.trim() || "";
  if (secret.length < 32) {
    return NextResponse.json(
      { error: "mainnet_not_configured", message: "POLICYGUARD_EXECUTION_SECRET must be configured before mainnet trading." },
      { status: 503 },
    );
  }

  const builder = getBuilderConfig();
  if (!builder.address) {
    return NextResponse.json({ error: "builder_not_configured", message: "SODEX_BUILDER_ADDRESS is missing." }, { status: 503 });
  }

  const [builderEligibility, userAccountID, approvals] = await Promise.all([
    checkBuilderEligibility(builder.address).catch(() => null),
    resolvePrimaryAccountID(userAddress).catch(() => null),
    queryBuilderApprovals(userAddress).catch(() => null),
  ]);

  if (!builderEligibility?.eligible || !builderEligibility.accountID) {
    return NextResponse.json(
      {
        error: "builder_not_eligible",
        message: "PolicyGuard's Builder account must hold at least 100 vUSDC in both SoDEX Spot and Perps.",
        builderEligibility,
      },
      { status: 503 },
    );
  }
  if (!userAccountID) {
    return NextResponse.json({ error: "sodex_account_not_found", message: "Activate this wallet on SoDEX mainnet first." }, { status: 409 });
  }

  const approved = Boolean(
    approvals?.perps.some((row) => row.builderID === builderEligibility.accountID && row.feeRate >= builder.fee),
  );
  if (!approved) {
    return NextResponse.json(
      { error: "builder_not_authorized", message: "Authorize PolicyGuard as a SoDEX Builder before preparing a mainnet trade." },
      { status: 403 },
    );
  }

  const { confirmSubmit: _confirmSubmit, ...order } = parsed.data;
  const market = await getMarketEvidence(order.asset);
  const decision = evaluatePolicy(order, market);

  if (decision.verdict === "REJECT" || decision.approvedNotionalUsd <= 0) {
    return NextResponse.json(
      {
        readyToSign: false,
        decision,
        message: "Policy rejected this trade; no mainnet order was prepared.",
      },
      { status: 200, headers: { "cache-control": "no-store" } },
    );
  }

  const prepared = buildMainnetMarketOrder({
    accountID: userAccountID,
    asset: order.asset,
    side: order.side,
    approvedNotionalUsd: decision.approvedNotionalUsd,
    markPrice: market.price,
    builder: { id: builderEligibility.accountID, fee: builder.fee },
  });

  const nonce = Date.now();
  const expiresAt = nonce + 3 * 60_000;
  const executionToken = createExecutionToken(
    {
      version: 1,
      userAddress,
      decisionId: decision.id,
      nonce,
      expiresAt,
      params: prepared.params,
    },
    secret,
  );

  return NextResponse.json(
    {
      readyToSign: true,
      decision,
      market,
      preparedOrder: {
        venue: "SoDEX mainnet",
        market: prepared.market,
        clientOrderId: prepared.clientOrderId,
        accountID: userAccountID,
        approvedNotionalUsd: decision.approvedNotionalUsd,
        builder: prepared.params.builder,
        params: prepared.params,
        payloadHash: prepared.payloadHash,
      },
      signing: {
        nonce,
        typedData: serializeTradeTypedData(prepared.payloadHash, nonce),
        executionToken,
        expiresAt,
      },
    },
    { headers: { "cache-control": "no-store" } },
  );
}
