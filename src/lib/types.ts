export type AssetSymbol = "BTC" | "ETH" | "SOL";
export type TradeSide = "LONG" | "SHORT";
export type Verdict = "APPROVE" | "REDUCE_SIZE" | "REQUIRE_CONFIRMATION" | "REJECT";
export type RiskLevel = "low" | "moderate" | "elevated" | "severe";
export type ExecutionStatus = "prepared" | "blocked" | "submitted";

export type ProposedOrder = {
  asset: AssetSymbol;
  side: TradeSide;
  notionalUsd: number;
  leverage: number;
  thesis: string;
  sourceAgent: string;
  userPolicy: {
    maxNotionalUsd: number;
    maxLeverage: number;
    requireHumanConfirmation: boolean;
  };
};

export type MarketEvidence = {
  provider: "SoSoValue" | "PolicyGuard Demo Adapter";
  mode: "live" | "demo" | "fallback";
  capturedAt: string;
  latencyMs: number;
  asset: AssetSymbol;
  price: number;
  priceChange24hPct: number;
  etfFlowUsd: number | null;
  news: Array<{ title: string; source?: string; publishedAt?: string; url?: string }>;
  endpoints: string[];
  warnings: string[];
};

export type PolicyCheck = {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
};

export type PolicyReceipt = {
  id: string;
  createdAt: string;
  proposedOrder: ProposedOrder;
  market: MarketEvidence;
  verdict: Verdict;
  riskLevel: RiskLevel;
  approvedNotionalUsd: number;
  requiredAction: "none" | "human_confirmation" | "revise_order" | "do_not_trade";
  reasons: string[];
  checks: PolicyCheck[];
  execution: {
    status: ExecutionStatus;
    venue: "SoDEX testnet";
    reason: string;
    preparedOrder: {
      market: string;
      side: TradeSide;
      notionalUsd: number;
      leverage: number;
      reduceOnly: boolean;
      clientOrderId: string;
    } | null;
  };
};
