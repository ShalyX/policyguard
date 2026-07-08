import { NextResponse } from "next/server";
import { getReceipt } from "@/lib/store";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const receipt = await getReceipt(id);
  if (!receipt) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(receipt, { headers: { "cache-control": "no-store" } });
}
