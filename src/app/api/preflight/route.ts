import { NextResponse } from "next/server";
import { preflightSchema } from "@/lib/request";
import { getMarketEvidence } from "@/lib/sosovalue";
import { evaluatePolicy } from "@/lib/policy";
import { attachSodexExecution } from "@/lib/sodex";
import { makeSharePacket, saveReceipt } from "@/lib/store";
import type { PolicyReceipt } from "@/lib/types";

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = preflightSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", issues: parsed.error.flatten() }, { status: 422 });
  }

  const { confirmSubmit, ...order } = parsed.data;
  const market = await getMarketEvidence(order.asset);
  const decision = evaluatePolicy(order, market);
  const execution = await attachSodexExecution({
    order,
    market,
    verdict: decision.verdict,
    approvedNotionalUsd: decision.approvedNotionalUsd,
    confirmSubmit,
  });

  const receipt: PolicyReceipt = { ...decision, execution };
  await saveReceipt(receipt);
  return NextResponse.json({ ...receipt, sharePacket: makeSharePacket(receipt) }, { headers: { "cache-control": "no-store" } });
}

export function GET() {
  return NextResponse.json({ error: "method_not_allowed", message: "Use POST to preflight a proposed order." }, { status: 405 });
}
