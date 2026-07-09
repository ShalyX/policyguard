# PolicyGuard

Pre-trade policy gateway for autonomous SoDEX agents — SoSoValue WaveHack Wave 3.

Not another trading bot. Agents propose an order; PolicyGuard audits it against SoSoValue market evidence + user policy, then **prepares and (when configured) submits** a signed SoDEX testnet order.

## Core flow

1. Agent proposes: asset, side, notional, leverage, thesis.
2. SoSoValue adapter fetches market/news/ETF context (`live` | `demo` | `fallback`).
3. Policy engine returns `APPROVE` | `REQUIRE_CONFIRMATION` | `REDUCE_SIZE` | `REJECT`.
4. SoDEX adapter builds a **prepared** perps market order (EIP-712 signing payload ready).
5. When `SODEX_TESTNET_SUBMIT_ENABLED=true` and signing credentials are present, PolicyGuard **signs and POSTs** to SoDEX testnet `/trade/orders`.
6. Public receipt records evidence, checks, verdict, prepared payload, and honest execution status.

## Honest execution status

| Status | Meaning |
| --- | --- |
| `blocked` | Policy rejected; no order prepared |
| `prepared` | Order payload ready; not submitted (missing creds, confirmation, or submit failed) |
| `submitted` | SoDEX accepted the order (`code: 0` and per-order `code: 0`) |

Never labels demo/fallback market data as a SoDEX fill. `submitted` only after a real external success response.

## Local setup

```bash
npm install
cp .env.example .env.local
# optional: SOSOVALUE_API_KEY=...
# SoDEX testnet submit (master-wallet mode for quick demos):
# SODEX_TESTNET_SUBMIT_ENABLED=true
# SODEX_TESTNET_SIGN_MODE=master
# SODEX_TESTNET_PRIVATE_KEY=0x...
# SODEX_TESTNET_ACCOUNT_ID=12345
# SODEX_TESTNET_MASTER_ADDRESS=0x...
npm run dev
```

Open http://localhost:3000.

## SoDEX testnet credentials

Two sign modes:

1. **Master (quick demo):** `SODEX_TESTNET_SIGN_MODE=master`  
   Omits `X-API-Key` and signs with the master wallet private key (SoDEX “default key”).
2. **API key (recommended for bots):** create a key at https://sodex.com/apikeys  
   - `SODEX_TESTNET_SIGN_MODE=api_key`
   - `SODEX_TESTNET_API_KEY` = exact key **name**
   - `SODEX_TESTNET_PRIVATE_KEY` = that key’s private key

Defaults:
- Submit URL: `https://testnet-gw.sodex.dev/api/v1/perps/trade/orders`
- Domain: `futures` · chainId: `138565`
- Body: params only (`accountID`, `symbolID`, `orders[]`)

Human-confirmation policies prepare the order and only submit when the request includes `confirmSubmit: true`.

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
  "confirmSubmit": false,
  "userPolicy": {
    "maxNotionalUsd": 1500,
    "maxLeverage": 3,
    "requireHumanConfirmation": true
  }
}
```

`GET /api/receipts/:id` — public audit receipt  
`GET /api/health` — integration booleans only (no secrets)

## Why this for Wave 3

Wave 3 is flooded with signal-to-execution agents. PolicyGuard is the complementary control plane: risk checks + SoDEX prepare/submit + audit receipt that other agents can call before they touch the orderbook.
