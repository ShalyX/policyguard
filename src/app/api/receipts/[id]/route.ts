import { NextResponse } from "next/server";
import { getReceipt } from "@/lib/store";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const packet = new URL(request.url).searchParams.get("packet");
  const receipt = await getReceipt(id, packet);
  if (!receipt) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(receipt, { headers: { "cache-control": "no-store" } });
}
