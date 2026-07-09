import { NextResponse } from "next/server";
import { sodexHealth } from "@/lib/sodex";

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "policyguard",
    integrations: {
      sosovalueConfigured: Boolean(process.env["SOSOVALUE_API_KEY"]),
      sodex: sodexHealth(),
    },
    timestamp: new Date().toISOString(),
  }, { headers: { "cache-control": "no-store" } });
}
