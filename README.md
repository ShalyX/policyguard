# PolicyGuard

Pre-trade risk gateway for autonomous SoDEX agents, built for the SoSoValue WaveHack Wave 3 theme: product completion, UX, and risk-control design.

## Why this exists

Wave 3 already has many AI trading agents. PolicyGuard is the layer they should call before execution: it audits a proposed SoDEX order against SoSoValue market evidence, user policy limits, and execution readiness, then emits a public audit receipt.

## Core flow

1. Agent proposes an order: asset, side, notional, leverage, thesis.
2. PolicyGuard fetches SoSoValue market evidence when `SOSOVALUE_API_KEY` is configured.
3. Policy engine checks notional, leverage, market movement, ETF-flow alignment, thesis consistency, and news risk.
4. App returns `APPROVE`, `REQUIRE_CONFIRMATION`, `REDUCE_SIZE`, or `REJECT`.
5. A public receipt records the evidence, checks, verdict, approved size, and SoDEX testnet readiness.

## Honest integration status

- SoSoValue API: live mode when `SOSOVALUE_API_KEY` is configured; otherwise explicit demo/fallback mode.
- SoDEX: order is prepared/gated. It is not labeled `submitted` unless a real adapter confirms external submission. Current MVP blocks submission without `SODEX_API_KEY` and live market mode.
- Real capital: not supported. This is a testnet/demo risk-control product.

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

## Verification

```bash
npm run lint
npm run test
npm run build
npm run dev -- -p 3000
POLICYGUARD_URL=http://localhost:3000 npm run smoke
```

## API

`POST /api/preflight`

```json
{
  "asset": "BTC",
  "side": "LONG",
  "notionalUsd": 1200,
  "leverage": 2,
  "thesis": "ETF inflows and positive market momentum support continuation, but check sizing and news risk before execution.",
  "sourceAgent": "demo-agent",
  "userPolicy": {
    "maxNotionalUsd": 1500,
    "maxLeverage": 3,
    "requireHumanConfirmation": true
  }
}
```

`GET /api/receipts/:id` returns the persisted public audit receipt.

## If time permits: Execution Replay Lab

After PolicyGuard is submitted, add a replay route that compares: proposed order, policy verdict, prepared/submitted SoDEX status, later market move, and whether the policy decision aged well.
