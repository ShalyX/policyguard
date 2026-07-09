import Link from "next/link";
import type { PolicyReceipt, Verdict } from "@/lib/types";

const verdictStyle: Record<Verdict, string> = {
  APPROVE: "text-signal border-signal/30 bg-signal/10",
  REQUIRE_CONFIRMATION: "text-caution border-caution/30 bg-caution/10",
  REDUCE_SIZE: "text-caution border-caution/30 bg-caution/10",
  REJECT: "text-danger border-danger/30 bg-danger/10",
};

const checkTone = {
  pass: "text-signal",
  warn: "text-caution",
  fail: "text-danger",
} as const;

export function ReceiptView({
  receipt,
  shareHref,
  compact = false,
}: {
  receipt: PolicyReceipt;
  shareHref?: string;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "fade-in" : "fade-in space-y-6"}>
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
        <div>
          <p className="mono text-[12px] uppercase tracking-[0.16em] text-faint">
            Audit receipt · {receipt.id.slice(0, 8)}
          </p>
          <h2 className="mt-2 text-3xl tracking-[-0.04em] text-ink sm:text-4xl">
            {receipt.proposedOrder.asset} {receipt.proposedOrder.side}
          </h2>
          <p className="mt-2 text-sm text-muted">
            {new Date(receipt.createdAt).toLocaleString()} · agent {receipt.proposedOrder.sourceAgent}
          </p>
        </div>
        <div className={`rounded-lg border px-4 py-3 text-right ${verdictStyle[receipt.verdict]}`}>
          <div className="mono text-[11px] uppercase tracking-[0.14em] opacity-80">Verdict</div>
          <div className="mt-1 text-xl font-medium tracking-[-0.03em]">{receipt.verdict}</div>
        </div>
      </div>

      <div className={`grid gap-3 ${compact ? "sm:grid-cols-3" : "sm:grid-cols-4"}`}>
        <Stat label="Approved" value={`$${receipt.approvedNotionalUsd.toLocaleString()}`} />
        <Stat label="Risk" value={receipt.riskLevel} />
        <Stat label="Market" value={receipt.market.mode} />
        {!compact && <Stat label="SoDEX" value={receipt.execution.status} />}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="SoSoValue evidence">
          <Row k="Price" v={`$${receipt.market.price.toLocaleString()}`} />
          <Row k="24h" v={`${receipt.market.priceChange24hPct.toFixed(2)}%`} />
          <Row
            k="ETF flow"
            v={receipt.market.etfFlowUsd === null ? "n/a" : `$${Math.round(receipt.market.etfFlowUsd).toLocaleString()}`}
          />
          <Row k="Latency" v={`${receipt.market.latencyMs}ms`} />
        </Panel>
        <Panel title="Execution">
          <Row k="Status" v={receipt.execution.status} />
          <Row k="Venue" v={receipt.execution.venue} />
          <Row k="clientOrderId" v={receipt.execution.orderId ?? "—"} mono />
          <Row k="sodexOrderId" v={receipt.execution.sodexOrderId ?? "—"} mono />
          <p className="mt-3 text-[13px] leading-6 text-muted">{receipt.execution.reason}</p>
        </Panel>
      </div>

      <Panel title="Policy checks">
        <div className="grid gap-2 sm:grid-cols-2">
          {receipt.checks.map((c) => (
            <div key={c.id} className="rounded-lg border border-line bg-background/40 px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-ink">{c.label}</span>
                <span className={`mono text-[11px] uppercase ${checkTone[c.status]}`}>{c.status}</span>
              </div>
              <p className="mt-1.5 text-[13px] leading-5 text-muted">{c.detail}</p>
            </div>
          ))}
        </div>
      </Panel>

      {!compact && (
        <Panel title="Thesis">
          <p className="text-[14px] leading-7 text-ink-2">{receipt.proposedOrder.thesis}</p>
        </Panel>
      )}

      {!compact && receipt.market.news.length > 0 && (
        <Panel title="Headlines">
          <ul className="space-y-2">
            {receipt.market.news.slice(0, 5).map((item, i) => (
              <li key={`${item.title}-${i}`} className="border-b border-line/70 pb-2 text-[13px] text-ink-2 last:border-0">
                {item.title}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {shareHref && (
        <Link href={shareHref} className="btn-ghost text-[13px]">
          Open public receipt →
        </Link>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-background/40 px-3.5 py-3">
      <div className="mono text-[11px] uppercase tracking-[0.14em] text-faint">{label}</div>
      <div className="mt-1.5 text-xl tracking-[-0.03em] text-ink">{value}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-background/30 p-4">
      <h3 className="mono text-[11px] uppercase tracking-[0.16em] text-faint">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line/50 py-1.5 text-[13px] last:border-0">
      <span className="text-muted">{k}</span>
      <span className={`${mono ? "mono" : ""} max-w-[65%] truncate text-right text-ink`}>{v}</span>
    </div>
  );
}
