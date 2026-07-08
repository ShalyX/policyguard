"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import type { PolicyReceipt, Verdict } from "@/lib/types";

const verdictTone: Record<Verdict, string> = {
  APPROVE: "border-signal/70 text-signal",
  REQUIRE_CONFIRMATION: "border-caution/70 text-caution",
  REDUCE_SIZE: "border-caution/70 text-caution",
  REJECT: "border-danger/70 text-danger",
};

export default function Home() {
  const [receipt, setReceipt] = useState<PolicyReceipt | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asset, setAsset] = useState("BTC");
  const [side, setSide] = useState("LONG");
  const [notionalUsd, setNotionalUsd] = useState(1200);
  const [leverage, setLeverage] = useState(2);
  const [sourceAgent, setSourceAgent] = useState("demo-momentum-agent");
  const [thesis, setThesis] = useState("ETF inflows and positive market momentum support a continuation trade, but the agent wants PolicyGuard to check sizing, news conflict, and SoDEX readiness before execution.");

  const payload = useMemo(() => ({
    asset, side, notionalUsd, leverage, thesis, sourceAgent,
    userPolicy: { maxNotionalUsd: 1500, maxLeverage: 3, requireHumanConfirmation: true },
  }), [asset, side, notionalUsd, leverage, thesis, sourceAgent]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true); setError(null); setReceipt(null);
    try {
      const res = await fetch("/api/preflight", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || body.error || "preflight_failed");
      setReceipt(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally { setLoading(false); }
  }

  return (
    <main className="receipt-grid min-h-screen overflow-hidden">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 text-sm text-muted">
        <div className="flex items-center gap-3 text-ink"><span className="h-3 w-3 rounded-full bg-signal shadow-[0_0_24px_#d7ff63]" />PolicyGuard</div>
        <div className="hidden gap-6 md:flex"><a href="#preflight">Preflight</a><a href="#receipt">Receipt</a><a href="#architecture">Architecture</a></div>
        <a className="rounded-full border border-line px-4 py-2 text-ink" href="https://github.com/SoSoValueLabs/ssi-protocol" target="_blank">SSI Protocol</a>
      </nav>

      <section className="mx-auto grid max-w-7xl gap-10 px-6 pb-16 pt-10 lg:grid-cols-[1.02fr_.98fr] lg:items-center">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-panel/70 px-3 py-1 text-xs uppercase tracking-[.22em] text-signal">Risk control for Wave 3</div>
          <h1 className="max-w-4xl text-5xl font-semibold tracking-[-.06em] text-ink md:text-7xl">Pre-trade policy gateway for autonomous SoDEX agents.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">Most submissions build AI traders. PolicyGuard is the missing control layer: every agent-proposed order is checked against live SoSoValue evidence, user limits, and execution readiness before it can touch the orderbook.</p>
          <div className="mt-8 grid max-w-2xl grid-cols-3 gap-3 text-sm">
            {[["1", "Proposed order"], ["2", "SoSoValue evidence"], ["3", "Policy verdict"]].map(([n, t]) => <div key={n} className="rounded-2xl border border-line bg-panel/65 p-4"><div className="font-mono text-signal">0{n}</div><div className="mt-2 text-ink">{t}</div></div>)}
          </div>
        </div>

        <form id="preflight" onSubmit={submit} className="rounded-[2rem] border border-line bg-[#10130d]/90 p-5 shadow-2xl shadow-black/40 backdrop-blur">
          <div className="mb-5 flex items-center justify-between"><div><p className="text-sm text-muted">Agent order intake</p><h2 className="text-2xl font-semibold text-ink">Run policy preflight</h2></div><span className="rounded-full bg-signal px-3 py-1 text-xs font-bold text-black">LIVE-GATED</span></div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm text-muted">Asset<select value={asset} onChange={e=>setAsset(e.target.value)} className="mt-2 w-full rounded-xl border border-line bg-background p-3 text-ink"><option>BTC</option><option>ETH</option><option>SOL</option></select></label>
            <label className="text-sm text-muted">Side<select value={side} onChange={e=>setSide(e.target.value)} className="mt-2 w-full rounded-xl border border-line bg-background p-3 text-ink"><option>LONG</option><option>SHORT</option></select></label>
            <label className="text-sm text-muted">Notional USD<input type="number" value={notionalUsd} onChange={e=>setNotionalUsd(Number(e.target.value))} className="mt-2 w-full rounded-xl border border-line bg-background p-3 text-ink" /></label>
            <label className="text-sm text-muted">Leverage<input type="number" value={leverage} onChange={e=>setLeverage(Number(e.target.value))} className="mt-2 w-full rounded-xl border border-line bg-background p-3 text-ink" /></label>
          </div>
          <label className="mt-3 block text-sm text-muted">Source agent<input value={sourceAgent} onChange={e=>setSourceAgent(e.target.value)} className="mt-2 w-full rounded-xl border border-line bg-background p-3 text-ink" /></label>
          <label className="mt-3 block text-sm text-muted">Agent thesis<textarea value={thesis} onChange={e=>setThesis(e.target.value)} rows={5} className="mt-2 w-full rounded-xl border border-line bg-background p-3 text-ink" /></label>
          <button disabled={loading} className="mt-5 w-full rounded-2xl bg-signal px-5 py-4 font-semibold text-black transition hover:brightness-110 disabled:opacity-60">{loading ? "Checking policy..." : "Preflight proposed SoDEX order"}</button>
          {error && <p className="mt-3 rounded-xl border border-danger/50 bg-danger/10 p-3 text-sm text-danger">{error}</p>}
        </form>
      </section>

      <section id="receipt" className="mx-auto max-w-7xl px-6 pb-20">
        <div className="grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
          <div className="rounded-[2rem] border border-line bg-panel/75 p-6"><p className="text-sm text-muted">Why this is not another bot</p><h2 className="mt-2 text-3xl font-semibold tracking-tight text-ink">PolicyGuard blocks, shrinks, or escalates trades instead of generating them.</h2><p className="mt-4 leading-7 text-muted">The artifact is a structured audit receipt: data provenance, policy checks, verdict, approved size, and SoDEX readiness. It is designed to plug into the many Wave 3 trading agents already shipping.</p></div>
          <div className="rounded-[2rem] border border-line bg-[#10130d]/90 p-6">
            {!receipt ? <div className="flex min-h-80 items-center justify-center text-center text-muted">Run a preflight to generate a public audit receipt.</div> : <ReceiptCard receipt={receipt} />}
          </div>
        </div>
      </section>

      <section id="architecture" className="mx-auto max-w-7xl px-6 pb-20">
        <div className="grid gap-4 md:grid-cols-4">
          {["POST /api/preflight", "SoSoValue adapter", "Policy engine", "Public receipt"].map((item, i) => <div key={item} className="rounded-3xl border border-line bg-panel/60 p-5"><div className="font-mono text-sm text-signal">0{i+1}</div><div className="mt-8 text-xl font-semibold text-ink">{item}</div></div>)}
        </div>
      </section>
    </main>
  );
}

function ReceiptCard({ receipt }: { receipt: PolicyReceipt }) {
  return <div>
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm text-muted">Receipt #{receipt.id.slice(0,8)}</p><h3 className="mt-1 text-3xl font-semibold text-ink">{receipt.proposedOrder.asset} {receipt.proposedOrder.side} preflight</h3></div><div className={`stamp rounded-xl border px-4 py-2 font-mono text-xl ${verdictTone[receipt.verdict]}`}>{receipt.verdict}</div></div>
    <div className="mt-6 grid gap-3 md:grid-cols-3"><Metric label="Approved notional" value={`$${receipt.approvedNotionalUsd.toLocaleString()}`} /><Metric label="Risk" value={receipt.riskLevel} /><Metric label="Market mode" value={receipt.market.mode} /></div>
    <div className="mt-6 grid gap-3 md:grid-cols-2">{receipt.checks.map(c=><div key={c.id} className="rounded-2xl border border-line bg-background/50 p-4"><div className="flex justify-between gap-3"><b className="text-ink">{c.label}</b><span className={c.status==='pass'?'text-signal':c.status==='fail'?'text-danger':'text-caution'}>{c.status}</span></div><p className="mt-2 text-sm leading-6 text-muted">{c.detail}</p></div>)}</div>
    <div className="mt-6 rounded-2xl border border-line bg-background/60 p-4"><b className="text-ink">Execution status</b><p className="mt-2 text-sm leading-6 text-muted">{receipt.execution.status.toUpperCase()} — {receipt.execution.reason}</p></div>
    <Link href={`/receipts/${receipt.id}`} className="mt-5 inline-flex rounded-full border border-signal px-5 py-3 text-signal">Open public receipt →</Link>
  </div>
}
function Metric({label,value}:{label:string,value:string}){return <div className="rounded-2xl border border-line bg-background/50 p-4"><p className="text-xs uppercase tracking-[.18em] text-muted">{label}</p><p className="mt-2 text-2xl font-semibold text-ink">{value}</p></div>}
