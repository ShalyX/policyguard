# PolicyGuard

Pre-trade policy gateway for autonomous SoDEX agents — SoSoValue WaveHack Wave 3.

Not another trading bot. Agents propose an order; PolicyGuard audits it against SoSoValue market evidence + user policy, then **prepares and (when configured) submits** a signed SoDEX testnet order.

## Live

- Product: https://policyguard-nine.vercel.app
- Desk: https://policyguard-nine.vercel.app/desk
- Repo: https://github.com/ShalyX/policyguard
- Judge packet: [SUBMISSION.md](./SUBMISSION.md)

## Core flow

1. Agent proposes: asset, side, notional, leverage, thesis.
2. SoSoValue adapter fetches market/news/ETF context (`live` | `demo` | `fallback`).
3. Policy engine returns `APPROVE` | `REQUIRE_CONFIRMATION` | `REDUCE_SIZE` | `REJECT`.
4. SoDEX adapter builds a **prepared** perps market order (EIP-712 signing payload ready).
5. When submit is enabled and credentials allow, PolicyGuard **signs and POSTs** to SoDEX testnet `/trade/orders`.
6. Public receipt records evidence, checks, verdict, prepared payload, and honest execution status.

## Honest execution status

| Status | Meaning |
| --- | --- |
| `blocked` | Policy rejected; no order prepared |
| `prepared` | Order payload ready; not submitted (missing creds, confirmation, or submit failed) |
| `submitted` | SoDEX accepted the order (`code: 0` and per-order `code: 0`) |

## Local setup

```bash
npm install
cp .env.example .env.local
# SOSOVALUE_API_KEY=...
# SODEX_TESTNET_SUBMIT_ENABLED=true
# SODEX_TESTNET_SIGN_MODE=master
# SODEX_TESTNET_PRIVATE_KEY=0x...
# SODEX_TESTNET_ACCOUNT_ID=12345
# SODEX_TESTNET_MASTER_ADDRESS=0x...
npm run dev
```

Open http://localhost:3000 then `/desk`.

## SoDEX sign modes

1. **Master (quick demo):** `SODEX_TESTNET_SIGN_MODE=master` — omits `X-API-Key`, signs with master wallet.
2. **API key (recommended for bots):** create a key at https://sodex.com/apikeys and set name + private key.

Defaults: futures domain · chainId `138565` · submit `https://testnet-gw.sodex.dev/api/v1/perps/trade/orders`

## Verification

```bash
npm run lint
npm run test
npm run build
POLICYGUARD_URL=http://localhost:3000 npm run smoke
```

## API

`POST /api/preflight` · `GET /api/receipts/:id` · `GET /api/health`

