import { NextRequest, NextResponse } from "next/server";
import type { Hex } from "viem";
import {
  checkBuilderEligibility,
  getBuilderConfig,
  queryBuilderApprovals,
  resolvePrimaryAccountID,
  SODEX_MAINNET_PUBLIC_URL,
} from "@/lib/sodex-builder";

function isAddress(value: string | null): value is Hex {
  return Boolean(value && /^0x[0-9a-fA-F]{40}$/.test(value));
}

export async function GET(request: NextRequest) {
  const userAddressRaw = request.nextUrl.searchParams.get("address");
  const userAddress = isAddress(userAddressRaw) ? userAddressRaw : null;
  const builder = getBuilderConfig();

  const builderEligibility = builder.address
    ? await checkBuilderEligibility(builder.address).catch(() => null)
    : null;

  let userAccountID: number | null = null;
  let approvals: Awaited<ReturnType<typeof queryBuilderApprovals>> = null;
  if (userAddress) {
    [userAccountID, approvals] = await Promise.all([
      resolvePrimaryAccountID(userAddress).catch(() => null),
      queryBuilderApprovals(userAddress).catch(() => null),
    ]);
  }

  const builderID = builderEligibility?.accountID ?? null;
  const approvedPerps = Boolean(
    builderID && approvals?.perps.some((row) => row.builderID === builderID && row.feeRate >= builder.fee),
  );
  const approvedSpot = Boolean(
    builderID && approvals?.spot.some((row) => row.builderID === builderID && row.feeRate >= builder.fee),
  );

  return NextResponse.json(
    {
      network: "mainnet",
      publicEndpoint: SODEX_MAINNET_PUBLIC_URL,
      builder: {
        address: builder.address,
        accountID: builderID,
        requestedFeeRate: builder.fee,
        requestedFeeBps: builder.fee / 10,
        eligibility: builderEligibility,
      },
      user: userAddress
        ? {
            address: userAddress,
            accountID: userAccountID,
            approvals,
            approvedPerps,
            approvedSpot,
          }
        : null,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
