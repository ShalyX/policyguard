const base = process.env.POLICYGUARD_URL || "http://localhost:3000";
const payload = {
  asset: "BTC",
  side: "LONG",
  notionalUsd: 1200,
  leverage: 2,
  thesis: "ETF inflows and positive market momentum support a continuation trade, but the agent wants PolicyGuard to check sizing, news conflict, and SoDEX readiness before execution.",
  sourceAgent: "smoke-agent",
  userPolicy: { maxNotionalUsd: 1500, maxLeverage: 3, requireHumanConfirmation: true }
};
const health = await fetch(`${base}/api/health`).then(r => r.json());
if (!health.ok) throw new Error("health failed");
const res = await fetch(`${base}/api/preflight`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
if (!res.ok) throw new Error(`preflight failed ${res.status}`);
const receipt = await res.json();
if (!receipt.id || !receipt.verdict || !Array.isArray(receipt.checks)) throw new Error("bad receipt shape");
const lookup = await fetch(`${base}/api/receipts/${receipt.id}`);
if (!lookup.ok) throw new Error("receipt lookup failed");
console.log(JSON.stringify({ ok: true, receiptId: receipt.id, verdict: receipt.verdict, mode: receipt.market.mode }, null, 2));
