import { NextResponse } from "next/server";
import { preflightSchema } from "@/lib/request";
import { getMarketEvidence } from "@/lib/sosovalue";
import { evaluatePolicy } from "@/lib/policy";
import { saveReceipt } from "@/lib/store";

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
  const market = await getMarketEvidence(parsed.data.asset);
  const receipt = evaluatePolicy(parsed.data, market);
  await saveReceipt(receipt);
  return NextResponse.json(receipt, { headers: { "cache-control": "no-store" } });
}

export function GET() {
  return NextResponse.json({ error: "method_not_allowed", message: "Use POST to preflight a proposed order." }, { status: 405 });
}
