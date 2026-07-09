# PolicyGuard — Wave 3 submission packet

## Links
- Live demo: https://policyguard-nine.vercel.app
- Desk: https://policyguard-nine.vercel.app/desk
- GitHub: https://github.com/ShalyX/policyguard
- SoSoValue API docs: https://sosovalue-1.gitbook.io/sosovalue-api-doc
- SoDEX API docs: https://sodex.com/documentation/trading-api/trading-api

## Paste-ready fields

**Project name**  
PolicyGuard

**Short description / tagline**  
Pre-trade policy gateway for autonomous SoDEX agents — evidence, verdict, signed prepare/submit, public audit receipt.

**Product type**  
Functional

**Deliverable URL**  
https://github.com/ShalyX/policyguard

**Live demo**  
https://policyguard-nine.vercel.app

**Build with**  
SoSoValue API, SoDEX Testnet, ValueChain Testnet, Next.js

**Category**  
Tools / Market Infrastructure / AI x Web3

**Tags**  
#SoSoValue #SoDEX #ValueChain #Agentic #On-Chain Finance #AI x Web3 #One-Person

**Target users**  
Solo agent operators and builders who already generate trade signals and need a risk/control layer before SoDEX execution.

## About (markdown)

### What it does
PolicyGuard is a pre-trade policy gateway. An agent proposes an order (asset, side, notional, leverage, thesis). PolicyGuard pulls live SoSoValue market evidence, runs policy checks, returns APPROVE / REQUIRE_CONFIRMATION / REDUCE_SIZE / REJECT, then prepares and can sign-submit a SoDEX testnet order. Every run produces a public audit receipt.

### The problem it solves
Wave 3 is full of signal-to-execution bots. Operators still lack a shared control plane that:
1. checks proposed size/leverage against user policy,
2. stamps decisions with live market/news context,
3. only marks execution as submitted after SoDEX accepts a signed order,
4. leaves a shareable receipt for audit.

### Challenges I ran into
- SoDEX trading requires EIP-712 typed signatures, correct field order, and either a registered API key name or master-wallet “default key” signing.
- Env values with inline comments broke credential parsing until normalization was hardened.
- Outer HTTP `code:0` can still contain per-order failures (e.g. insufficient margin); success must inspect order-level codes.

### Technologies I used
- SoSoValue OpenAPI (currencies, market-snapshot, news, ETF summary-history)
- SoDEX testnet perps trade API (EIP-712, master or API-key sign mode)
- Next.js 16 App Router, TypeScript, Zod, viem
- Vercel production deploy

### How we built it
1. `POST /api/preflight` validates intake and loads market evidence.
2. Policy engine scores hard limits, movement, ETF alignment, thesis consistency, news risk.
3. SoDEX adapter builds a market IOC order, signs ExchangeAction, optionally submits.
4. Receipts persist locally (or via share packet on Vercel) and render as public documents.
5. Product UX splits pitch (`/`) from operator desk (`/desk`).

### What we learned
Risk control is a product, not a panel bolted onto another bot. Honest execution states matter more than claiming autonomy.

### What's next for PolicyGuard
- Execution Replay Lab (did the policy call age well?)
- Agent SDK / webhook intake for other WaveHack agents
- Dedicated SoDEX API keys instead of master-wallet demo mode

## Wave 3 changelog
- Live SoSoValue evidence adapter with explicit live/demo/fallback modes
- Signed SoDEX testnet prepare/submit (master + API-key modes)
- Public audit receipts with order IDs
- Enterprise product UI: brand mark, gate motion, pitch/desk split, dense receipts
- Production deploy with real testnet orders accepted by SoDEX

## Demo path (2 minutes)
1. Open https://policyguard-nine.vercel.app — product pitch.
2. Click **Open desk**.
3. Keep a small notional (e.g. $15–25), confirm SoDEX submit checked.
4. Run preflight.
5. Show verdict + SoDEX status (`submitted` when accepted).
6. Open public receipt.
7. Optional: match `sodexOrderId` on SoDEX dashboard.

## Video title / description
**Title:** PolicyGuard — pre-trade policy gateway for SoDEX agents  
**Description:**  
PolicyGuard audits AI-proposed SoDEX orders against live SoSoValue evidence and user risk policy, then prepares/submits a signed testnet order with a public audit receipt.  
Demo: https://policyguard-nine.vercel.app  
Repo: https://github.com/ShalyX/policyguard  
Stack: SoSoValue API + SoDEX testnet

## Demo video artifact
- Local path: `/root/policyguard-demo-video/policyguard-enterprise-demo.mp4`
- Format: 1920x1080 · 30fps · ~54s · AAC + H.264
- Live SoDEX order shown in capture: see `receipt-meta.json`
- Upload to YouTube, then paste URL into Akindo video field.
