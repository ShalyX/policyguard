import type { AssetSymbol, MarketEvidence } from "./types";

type JsonObject = Record<string, unknown>;
const BASE_URL = "https://openapi.sosovalue.com/openapi/v1";

const demoPrices: Record<AssetSymbol, { price: number; change: number; etf: number | null }> = {
  BTC: { price: 108420, change: 2.7, etf: 184_000_000 },
  ETH: { price: 3925, change: -1.8, etf: -41_000_000 },
  SOL: { price: 186, change: 6.4, etf: null },
};

function unwrap(data: unknown): unknown {
  if (data && typeof data === "object" && "data" in data) return (data as JsonObject).data;
  return data;
}

function numberFrom(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

async function fetchJson(url: string, apiKey: string, signal: AbortSignal): Promise<unknown> {
  const res = await fetch(url, {
    signal,
    headers: { accept: "application/json", "x-soso-api-key": apiKey },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`upstream_${res.status}`);
  return res.json();
}

function cleanText(value: unknown): string {
  return String(value ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function demoEvidence(asset: AssetSymbol, mode: "demo" | "fallback", warnings: string[], started: number): MarketEvidence {
  const p = demoPrices[asset];
  return {
    provider: "PolicyGuard Demo Adapter",
    mode,
    capturedAt: new Date().toISOString(),
    latencyMs: Date.now() - started,
    asset,
    price: p.price,
    priceChange24hPct: p.change,
    etfFlowUsd: p.etf,
    news: [
      { title: `${asset} market momentum is mixed as traders digest ETF flow and macro headlines`, source: "demo-feed" },
      { title: "Risk desks continue to reduce leverage after rapid intraday moves", source: "demo-feed" },
      { title: "Liquidity remains fragmented across venues during high-volatility windows", source: "demo-feed" },
    ],
    endpoints: [],
    warnings,
  };
}

export async function getMarketEvidence(asset: AssetSymbol): Promise<MarketEvidence> {
  const started = Date.now();
  const apiKey = process.env["SOSOVALUE_API_KEY"];
  if (!apiKey) {
    return demoEvidence(asset, "demo", ["SOSOVALUE_API_KEY is not configured; using explicit demo data."], started);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  const endpoints: string[] = [];
  try {
    const currenciesUrl = `${BASE_URL}/currencies`;
    endpoints.push("GET /currencies");
    const currencies = unwrap(await fetchJson(currenciesUrl, apiKey, controller.signal));
    const list = Array.isArray(currencies) ? currencies : Array.isArray((currencies as JsonObject)?.list) ? (currencies as JsonObject).list as unknown[] : [];
    const match = list.find((item) => {
      const row = item as JsonObject;
      return String(row.symbol ?? row.currency_symbol ?? "").toUpperCase() === asset;
    }) as JsonObject | undefined;
    const currencyId = String(match?.id ?? match?.currency_id ?? "");
    if (!currencyId) throw new Error("currency_not_found");

    const marketUrl = `${BASE_URL}/currencies/${currencyId}/market-snapshot`;
    const newsUrl = `${BASE_URL}/news?page=1&page_size=6`;
    const etfUrl = `${BASE_URL}/etfs/summary-history?country_code=US`;
    endpoints.push("GET /currencies/{currency_id}/market-snapshot", "GET /news", "GET /etfs/summary-history?country_code=US");

    const [marketRaw, newsRaw, etfRaw] = await Promise.all([
      fetchJson(marketUrl, apiKey, controller.signal).catch((error) => ({ error: String(error) })),
      fetchJson(newsUrl, apiKey, controller.signal).catch((error) => ({ error: String(error) })),
      fetchJson(etfUrl, apiKey, controller.signal).catch((error) => ({ error: String(error) })),
    ]);
    const market = unwrap(marketRaw) as JsonObject;
    const newsData = unwrap(newsRaw) as JsonObject;
    const etfData = unwrap(etfRaw) as JsonObject;
    const demo = demoPrices[asset];
    let change = numberFrom(market?.change_pct_24h, demo.change);
    if (Math.abs(change) < 1) change *= 100;
    const rawNews = Array.isArray(newsData?.list) ? newsData.list as JsonObject[] : Array.isArray(newsData) ? newsData as JsonObject[] : [];
    const rawEtf = Array.isArray(etfData?.list) ? etfData.list[0] as JsonObject : Array.isArray(etfData) ? etfData[0] as JsonObject : etfData;

    return {
      provider: "SoSoValue",
      mode: "live",
      capturedAt: new Date().toISOString(),
      latencyMs: Date.now() - started,
      asset,
      price: numberFrom(market?.price, demo.price),
      priceChange24hPct: change,
      etfFlowUsd: asset === "SOL" ? null : numberFrom(rawEtf?.total_net_inflow, demo.etf ?? 0),
      news: rawNews.map((row) => ({
        title: cleanText(row.title ?? row.name),
        source: row.source ? cleanText(row.source) : undefined,
        publishedAt: row.published_at ? String(row.published_at) : row.created_at ? String(row.created_at) : undefined,
        url: row.url ? String(row.url) : undefined,
      })).filter((item) => item.title && !/^untitled\b/i.test(item.title)).slice(0, 6),
      endpoints,
      warnings: [],
    };
  } catch (error) {
    return demoEvidence(asset, "fallback", [`Live SoSoValue adapter failed with ${error instanceof Error ? error.message : "upstream_error"}; fallback is explicitly labeled.`], started);
  } finally {
    clearTimeout(timeout);
  }
}
