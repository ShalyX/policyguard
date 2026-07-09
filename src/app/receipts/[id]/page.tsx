import Link from "next/link";
import { getReceipt } from "@/lib/store";
import { notFound } from "next/navigation";

export default async function ReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ packet?: string }>;
}) {
  const { id } = await params;
  const { packet } = await searchParams;
  const receipt = await getReceipt(id, packet);
  if (!receipt) notFound();
  return (
    <main className="receipt-grid min-h-screen px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="text-sm text-signal">← Back to PolicyGuard</Link>
        <section className="mt-6 rounded-[2rem] border border-line bg-[#10130d]/95 p-6 shadow-2xl shadow-black/40">
          <div className="flex flex-wrap items-start justify-between gap-6 border-b border-line pb-6">
            <div>
              <p className="font-mono text-sm text-muted">AUDIT RECEIPT / {receipt.id.slice(0, 8)}</p>
              <h1 className="mt-2 text-5xl font-semibold tracking-[-.05em] text-ink">{receipt.verdict}</h1>
              <p className="mt-3 text-muted">Created {new Date(receipt.createdAt).toLocaleString()}</p>
            </div>
            <div className="stamp rounded-2xl border border-signal/70 px-6 py-4 text-center font-mono text-signal"><div className="text-xs">POLICY</div><div className="text-2xl">{receipt.riskLevel.toUpperCase()}</div></div>
          </div>

          <div className="grid gap-4 py-6 md:grid-cols-4">
            <Metric label="Asset" value={receipt.proposedOrder.asset} />
            <Metric label="Side" value={receipt.proposedOrder.side} />
            <Metric label="Requested" value={`$${receipt.proposedOrder.notionalUsd.toLocaleString()}`} />
            <Metric label="Approved" value={`$${receipt.approvedNotionalUsd.toLocaleString()}`} />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="SoSoValue evidence">
              <p>Mode: <b className="text-ink">{receipt.market.mode}</b></p>
              <p>Price: <b className="text-ink">${receipt.market.price.toLocaleString()}</b></p>
              <p>24h move: <b className="text-ink">{receipt.market.priceChange24hPct.toFixed(2)}%</b></p>
              <p>ETF flow: <b className="text-ink">{receipt.market.etfFlowUsd === null ? "n/a" : `$${Math.round(receipt.market.etfFlowUsd).toLocaleString()}`}</b></p>
              {receipt.market.endpoints.length > 0 && <p className="mt-3 text-xs text-muted">Sources: {receipt.market.endpoints.join(" · ")}</p>}
              {receipt.market.warnings.map(w => <p key={w} className="mt-3 text-caution">{w}</p>)}
            </Panel>
            <Panel title="Agent thesis"><p>{receipt.proposedOrder.thesis}</p></Panel>
          </div>

          <Panel title="Evidence headlines" className="mt-5">
            <ul className="space-y-2">
              {receipt.market.news.slice(0, 5).map((item, index) => <li key={`${item.title}-${index}`} className="border-b border-line/60 pb-2 last:border-0">{item.title}</li>)}
            </ul>
          </Panel>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {receipt.checks.map(c => <div key={c.id} className="rounded-2xl border border-line bg-background/50 p-4"><div className="flex justify-between"><b className="text-ink">{c.label}</b><span className={c.status === "pass" ? "text-signal" : c.status === "fail" ? "text-danger" : "text-caution"}>{c.status}</span></div><p className="mt-2 text-sm leading-6 text-muted">{c.detail}</p></div>)}
          </div>

          <Panel title="SoDEX prepare / submit" className="mt-5">
            <p>Status: <b className="text-ink">{receipt.execution.status}</b></p>
            <p className="mt-2">{receipt.execution.reason}</p>
            <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
              <p>clientOrderId: <b className="text-ink">{receipt.execution.orderId ?? "—"}</b></p>
              <p>sodexOrderId: <b className="text-ink">{receipt.execution.sodexOrderId ?? "—"}</b></p>
              <p>submitAttempted: <b className="text-ink">{String(receipt.execution.submitAttempted)}</b></p>
              <p>HTTP: <b className="text-ink">{receipt.execution.submitHttpStatus ?? "—"}</b></p>
            </div>
            {receipt.execution.payloadHash && <p className="mt-3 break-all font-mono text-xs text-signal">payloadHash: {receipt.execution.payloadHash}</p>}
            {receipt.execution.preparedOrder && <pre className="mt-4 max-h-64 overflow-auto rounded-xl border border-line bg-black/30 p-4 text-xs text-signal">{JSON.stringify(receipt.execution.preparedOrder, null, 2)}</pre>}
            {receipt.execution.responseSnippet && <pre className="mt-3 max-h-40 overflow-auto rounded-xl border border-line bg-black/30 p-4 text-xs text-muted">{receipt.execution.responseSnippet}</pre>}
          </Panel>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-line bg-background/50 p-4"><p className="text-xs uppercase tracking-[.18em] text-muted">{label}</p><p className="mt-2 text-2xl font-semibold text-ink">{value}</p></div> }
function Panel({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) { return <div className={`rounded-2xl border border-line bg-background/50 p-5 text-sm leading-7 text-muted ${className}`}><h2 className="mb-3 text-xl font-semibold text-ink">{title}</h2>{children}</div> }
