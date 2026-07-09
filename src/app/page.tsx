import Link from "next/link";
import { Shell } from "@/components/Shell";

export default function Home() {
  return (
    <Shell active="home">
      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl gap-10 px-5 pb-16 pt-14 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-14 lg:pb-24 lg:pt-20">
          <div className="fade-in">
            <p className="mono text-[12px] uppercase tracking-[0.18em] text-faint">Pre-trade control plane</p>
            <h1 className="display mt-5 max-w-xl text-[2.75rem] text-ink sm:text-6xl lg:text-[4rem]">
              Agents propose.
              <br />
              Policy decides.
            </h1>
            <p className="mt-6 max-w-lg text-[17px] leading-8 text-muted">
              PolicyGuard is the risk layer between AI signals and the SoDEX orderbook — live SoSoValue evidence,
              size and leverage policy, signed prepare/submit, public audit receipt.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/desk" className="btn-primary">
                Open the desk
              </Link>
              <a
                href="https://github.com/ShalyX/policyguard"
                target="_blank"
                rel="noreferrer"
                className="btn-ghost"
              >
                View source
              </a>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-faint">
              <span className="inline-flex items-center gap-2">
                <span className="status-dot bg-signal" /> Live SoSoValue
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="status-dot bg-accent" /> SoDEX testnet submit
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="status-dot bg-ink-2" /> Public receipts
              </span>
            </div>
          </div>

          <div className="gate-visual fade-in relative min-h-[380px] rounded-2xl border border-line p-6 sm:min-h-[440px] sm:p-8">
            <div className="relative z-10 flex h-full flex-col justify-between">
              <div className="flex items-center justify-between text-[12px] text-faint">
                <span className="mono uppercase tracking-[0.16em]">Execution path</span>
                <span className="mono">t+0 → receipt</span>
              </div>

              <div className="mt-10 space-y-4">
                {[
                  { label: "Agent order", detail: "BTC LONG · $1,200 · 2×", state: "inbound" },
                  { label: "SoSoValue packet", detail: "price · ETF flow · news", state: "evidence" },
                  { label: "Policy engine", detail: "APPROVE · REDUCE · REJECT", state: "gate" },
                  { label: "SoDEX adapter", detail: "prepare · sign · submit", state: "out" },
                ].map((row, i) => (
                  <div
                    key={row.label}
                    className="gate-node flex items-center justify-between rounded-xl border border-line bg-[#0f1011]/90 px-4 py-3.5 backdrop-blur"
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    <div>
                      <div className="text-[14px] font-medium text-ink">{row.label}</div>
                      <div className="mt-0.5 mono text-[12px] text-faint">{row.detail}</div>
                    </div>
                    <div className="mono text-[11px] uppercase tracking-[0.12em] text-accent">{String(i + 1).padStart(2, "0")}</div>
                  </div>
                ))}
              </div>

              <div className="mt-8 rounded-xl border border-line bg-black/30 px-4 py-3 mono text-[12px] text-muted">
                POST /api/preflight → verdict + execution receipt
              </div>
            </div>
          </div>
        </section>

        {/* Proof strip */}
        <section className="border-y border-line bg-panel/60">
          <div className="mx-auto grid max-w-6xl gap-px sm:grid-cols-3">
            {[
              { k: "Not another bot", v: "Policy only audits proposed orders. No signal generation." },
              { k: "Evidence first", v: "SoSoValue market, ETF flow, and headlines stamp every decision." },
              { k: "Honest execution", v: "submitted only after SoDEX accepts a signed testnet order." },
            ].map((item) => (
              <div key={item.k} className="px-5 py-8 sm:px-8">
                <h2 className="text-[15px] font-medium tracking-[-0.02em] text-ink">{item.k}</h2>
                <p className="mt-2 max-w-xs text-[14px] leading-6 text-muted">{item.v}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Product moment */}
        <section className="mx-auto max-w-6xl px-5 py-20 sm:px-6">
          <div className="max-w-2xl">
            <p className="mono text-[12px] uppercase tracking-[0.18em] text-faint">For operators</p>
            <h2 className="display mt-4 text-3xl text-ink sm:text-4xl">
              One request. One receipt. Clear next action.
            </h2>
            <p className="mt-4 text-[16px] leading-7 text-muted">
              Plug any agent into the preflight API. Get back approved size, policy checks, and SoDEX readiness —
              then share a public receipt for audit.
            </p>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {[
              { t: "Intake", d: "Asset, side, notional, leverage, thesis, agent id, user policy caps." },
              { t: "Decide", d: "Hard limits, ETF conflict, news risk, thesis consistency, live-data mode." },
              { t: "Execute", d: "Prepared order payload. Signed submit when credentials and confirm allow." },
            ].map((card, i) => (
              <div key={card.t} className="surface rounded-2xl p-5">
                <div className="mono text-[12px] text-accent">0{i + 1}</div>
                <h3 className="mt-6 text-lg tracking-[-0.02em] text-ink">{card.t}</h3>
                <p className="mt-2 text-[14px] leading-6 text-muted">{card.d}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-wrap items-center gap-4">
            <Link href="/desk" className="btn-primary">
              Run a preflight
            </Link>
            <p className="text-[13px] text-faint">No signup. Demo uses live market data when configured.</p>
          </div>
        </section>
      </main>
    </Shell>
  );
}
