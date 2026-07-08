import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "policyguard",
    integrations: {
      sosovalueConfigured: Boolean(process.env["SOSOVALUE_API_KEY"]),
      sodexConfigured: Boolean(process.env["SODEX_API_KEY"]),
    },
    timestamp: new Date().toISOString(),
  }, { headers: { "cache-control": "no-store" } });
}
