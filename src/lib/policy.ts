import type { MarketEvidence, PolicyCheck, PolicyReceipt, ProposedOrder, Verdict, RiskLevel } from "./types";

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function hasBullishText(text: string): boolean {
  return /(long|buy|bull|upside|inflow|positive|accumulat|breakout|momentum|continuation)/i.test(text);
}

function hasBearishText(text: string): boolean {
  return /(short|sell|bear|downside|outflow|negative|risk|dump|regulat|hack|exploit|reversal)/i.test(text);
}

export function evaluatePolicy(order: ProposedOrder, market: MarketEvidence): PolicyReceipt {
  const checks: PolicyCheck[] = [];
  const reasons: string[] = [];
  let score = 0;

  const notionalRatio = order.notionalUsd / order.userPolicy.maxNotionalUsd;
  if (order.notionalUsd > order.userPolicy.maxNotionalUsd) {
    checks.push({ id: "notional", label: "Max notional", status: "fail", detail: `Requested $${order.notionalUsd.toLocaleString()} exceeds policy max $${order.userPolicy.maxNotionalUsd.toLocaleString()}.` });
    score += 35;
  } else if (notionalRatio > 0.75) {
    checks.push({ id: "notional", label: "Max notional", status: "warn", detail: `Requested size uses ${Math.round(notionalRatio * 100)}% of policy budget.` });
    score += 12;
  } else checks.push({ id: "notional", label: "Max notional", status: "pass", detail: "Requested notional is inside user policy." });

  if (order.leverage > order.userPolicy.maxLeverage) {
    checks.push({ id: "leverage", label: "Leverage cap", status: "fail", detail: `${order.leverage}x exceeds policy cap of ${order.userPolicy.maxLeverage}x.` });
    score += 30;
  } else if (order.leverage >= Math.max(2, order.userPolicy.maxLeverage * 0.8)) {
    checks.push({ id: "leverage", label: "Leverage cap", status: "warn", detail: `${order.leverage}x is close to the user's leverage cap.` });
    score += 10;
  } else checks.push({ id: "leverage", label: "Leverage cap", status: "pass", detail: "Leverage is within policy." });

  const move = market.priceChange24hPct;
  const extendedLong = order.side === "LONG" && move > 5;
  const fallingLong = order.side === "LONG" && move < -4;
  const squeezeShort = order.side === "SHORT" && move > 4;
  const extendedShort = order.side === "SHORT" && move < -5;
  if (extendedLong || fallingLong || squeezeShort || extendedShort) {
    checks.push({ id: "movement", label: "Adverse/extended move", status: "warn", detail: `${market.asset} moved ${move.toFixed(2)}% in 24h; order direction needs confirmation.` });
    score += 18;
    reasons.push("Recent market movement makes full-size execution unsafe without confirmation.");
  } else checks.push({ id: "movement", label: "Adverse/extended move", status: "pass", detail: `24h move is ${move.toFixed(2)}%, inside the default preflight band.` });

  if (market.etfFlowUsd !== null) {
    const etfSupports = (order.side === "LONG" && market.etfFlowUsd > 0) || (order.side === "SHORT" && market.etfFlowUsd < 0);
    if (Math.abs(market.etfFlowUsd) > 25_000_000 && !etfSupports) {
      checks.push({ id: "etf-flow", label: "ETF flow alignment", status: "warn", detail: `ETF flow of $${Math.round(market.etfFlowUsd).toLocaleString()} conflicts with the proposed ${order.side}.` });
      score += 14;
    } else {
      checks.push({ id: "etf-flow", label: "ETF flow alignment", status: "pass", detail: `ETF flow context is not blocking this ${order.side}.` });
      if (etfSupports) reasons.push("ETF flow supports the proposed direction.");
    }
  } else checks.push({ id: "etf-flow", label: "ETF flow alignment", status: "pass", detail: "ETF flow check is not applicable to this asset." });

  const thesis = order.thesis;
  const bullish = hasBullishText(thesis);
  const bearish = hasBearishText(thesis);
  const thesisConflict = (order.side === "LONG" && bearish && !bullish) || (order.side === "SHORT" && bullish && !bearish);
  if (thesisConflict) {
    checks.push({ id: "thesis", label: "Thesis/order consistency", status: "fail", detail: "The written thesis appears to conflict with the order direction." });
    score += 25;
  } else if (thesis.length < 80) {
    checks.push({ id: "thesis", label: "Thesis/order consistency", status: "warn", detail: "The thesis is short; PolicyGuard requires clearer evidence for autonomous agents." });
    score += 8;
  } else checks.push({ id: "thesis", label: "Thesis/order consistency", status: "pass", detail: "The thesis is directionally consistent and sufficiently specific." });

  const newsText = market.news.map((n) => n.title).join(" ");
  if (/(hack|exploit|lawsuit|regulat|ban|insolv|outage|liquidat)/i.test(newsText)) {
    checks.push({ id: "news", label: "News conflict scan", status: "warn", detail: "Recent headlines contain risk terms; human review is recommended." });
    score += 12;
  } else checks.push({ id: "news", label: "News conflict scan", status: "pass", detail: "No blocking risk terms found in the sampled headlines." });

  if (market.mode !== "live") {
    checks.push({ id: "source-mode", label: "Live data mode", status: "warn", detail: `Market packet is ${market.mode}; execution cannot be marked submitted.` });
    score += 5;
  } else checks.push({ id: "source-mode", label: "Live data mode", status: "pass", detail: "SoSoValue live adapter returned a packet." });

  let riskLevel: RiskLevel = "low";
  if (score >= 65) riskLevel = "severe";
  else if (score >= 38) riskLevel = "elevated";
  else if (score >= 16) riskLevel = "moderate";

  let verdict: Verdict = "APPROVE";
  if (checks.some((c) => c.status === "fail") && score >= 55) verdict = "REJECT";
  else if (checks.some((c) => c.status === "fail") || score >= 38) verdict = "REDUCE_SIZE";
  else if (score >= 16 || order.userPolicy.requireHumanConfirmation) verdict = "REQUIRE_CONFIRMATION";

  const reduceFactor = verdict === "REJECT" ? 0 : verdict === "REDUCE_SIZE" ? 0.35 : verdict === "REQUIRE_CONFIRMATION" ? 0.75 : 1;
  const approvedNotionalUsd = Math.round(clamp(order.notionalUsd * reduceFactor, 0, order.userPolicy.maxNotionalUsd));
  if (reasons.length === 0) reasons.push("Policy checks did not find a blocking conflict between the order, user limits, and market evidence.");
  if (verdict === "REDUCE_SIZE") reasons.push("PolicyGuard reduced the order rather than blindly executing the agent proposal.");
  if (verdict === "REJECT") reasons.push("One or more hard policy checks failed; the agent should not trade this order.");

  const canPrepare = verdict !== "REJECT" && approvedNotionalUsd > 0;
  const sodexConfigured = Boolean(process.env["SODEX_API_KEY"]);
  const execution = {
    status: canPrepare && sodexConfigured && market.mode === "live" ? "prepared" as const : "blocked" as const,
    venue: "SoDEX testnet" as const,
    reason: canPrepare
      ? sodexConfigured && market.mode === "live"
        ? "Order passed policy preflight and is prepared for a SoDEX testnet adapter. Submission remains user-confirmed."
        : "Order passed policy preflight, but live SoDEX submission is blocked until SODEX_API_KEY and live market mode are configured."
      : "Policy rejected this order; no SoDEX order is prepared.",
    preparedOrder: canPrepare
      ? { market: `${order.asset}-USDC-PERP`, side: order.side, notionalUsd: approvedNotionalUsd, leverage: order.leverage, reduceOnly: false, clientOrderId: `pg-${crypto.randomUUID()}` }
      : null,
  };

  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    proposedOrder: order,
    market,
    verdict,
    riskLevel,
    approvedNotionalUsd,
    requiredAction: verdict === "APPROVE" ? "none" : verdict === "REQUIRE_CONFIRMATION" ? "human_confirmation" : verdict === "REDUCE_SIZE" ? "revise_order" : "do_not_trade",
    reasons,
    checks,
    execution,
  };
}
