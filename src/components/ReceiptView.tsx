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
    <div className={`receipt fade-in ${compact ? "space-y-4" : "space-y-5"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
        <div className="min-w-0">
          <p className="mono text-[10px] uppercase tracking-[0.18em] text-faint">
            Audit · {receipt.id.slice(0, 8)}
          </p>
          <h2 className="mt-1.5 text-[1.65rem] font-medium tracking-[-0.045em] text-ink sm:text-[1.85rem]">
            {receipt.proposedOrder.asset}
            <span className="mx-1.5 text-faint">/</span>
            {receipt.proposedOrder.side}
          </h2>
          <p className="mt-1 mono text-[11px] tabular-nums text-muted">
            {new Date(receipt.createdAt).toLocaleString()} · {receipt.proposedOrder.sourceAgent}
          </p>
        </div>
        <div className={`rounded-md border px-3 py-2 text-right ${verdictStyle[receipt.verdict]}`}>
          <div className="mono text-[9px] uppercase tracking-[0.16em] opacity-75">Verdict</div>
          <div className="mt-0.5 mono text-[13px] font-medium tracking-[-0.02em]">{receipt.verdict}</div>
        </div>
      </div>

      <div className={`grid gap-2 ${compact ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4"}`}>
        <Stat label="Approved" value={`$${receipt.approvedNotionalUsd.toLocaleString()}`} />
        <Stat label="Risk" value={receipt.riskLevel} />
        <Stat label="Market" value={receipt.market.mode} />
        {!compact && <Stat label="SoDEX" value={receipt.execution.status} />}
      </div>

      <div className="grid gap-2 lg:grid-cols-2">
        <Panel title="Evidence">
          <Row k="Price" v={`$${receipt.market.price.toLocaleString()}`} />
          <Row k="24h" v={`${receipt.market.priceChange24hPct.toFixed(2)}%`} />
          <Row
            k="ETF"
            v={receipt.market.etfFlowUsd === null ? "n/a" : `$${Math.round(receipt.market.etfFlowUsd).toLocaleString()}`}
          />
          <Row k="Latency" v={`${receipt.market.latencyMs}ms`} />
        </Panel>
        <Panel title="Execution">
          <Row k="Status" v={receipt.execution.status} />
          <Row k="Venue" v={receipt.execution.venue} />
          <Row k="client" v={receipt.execution.orderId ?? "—"} mono />
          <Row k="order" v={receipt.execution.sodexOrderId ?? "—"} mono />
          <p className="mt-2 text-[12px] leading-5 text-muted">{receipt.execution.reason}</p>
          {receipt.execution.sodexOrderId ? (
            <a
              href="https://sodex.com"
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-[11px] text-accent hover:underline"
            >
              Verify on SoDEX dashboard →
            </a>
          ) : null}
        </Panel>
      </div>

      <Panel title="Checks">
        <div className="grid gap-1.5 sm:grid-cols-2">
          {receipt.checks.map((c) => (
            <div key={c.id} className="rounded-md border border-line bg-background/40 px-2.5 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12.5px] font-medium tracking-[-0.01em] text-ink">{c.label}</span>
                <span className={`mono text-[10px] uppercase tracking-[0.08em] ${checkTone[c.status]}`}>{c.status}</span>
              </div>
              <p className="mt-1 text-[11.5px] leading-[1.45] text-muted">{c.detail}</p>
            </div>
          ))}
        </div>
      </Panel>

      {!compact && (
        <Panel title="Thesis">
          <p className="text-[12.5px] leading-5 text-ink-2">{receipt.proposedOrder.thesis}</p>
        </Panel>
      )}

      {!compact && receipt.market.news.length > 0 && (
        <Panel title="Headlines">
          <ul className="space-y-1.5">
            {receipt.market.news.slice(0, 5).map((item, i) => (
              <li
                key={`${item.title}-${i}`}
                className="border-b border-line/60 pb-1.5 text-[12px] leading-5 text-ink-2 last:border-0 last:pb-0"
              >
                {item.title}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {shareHref && (
        <Link href={shareHref} className="btn-ghost !px-3 !py-2 text-[12px]">
          Open public receipt →
        </Link>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-background/40 px-2.5 py-2">
      <div className="mono text-[9px] uppercase tracking-[0.16em] text-faint">{label}</div>
      <div className="mt-1 mono text-[15px] font-medium tabular-nums tracking-[-0.03em] text-ink">{value}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-background/25 px-3 py-2.5">
      <h3 className="mono text-[9px] uppercase tracking-[0.18em] text-faint">{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line/40 py-1 text-[12px] last:border-0">
      <span className="text-faint">{k}</span>
      <span className={`${mono ? "mono" : "tabular-nums"} max-w-[70%] truncate text-right text-ink`}>{v}</span>
    </div>
  );
}
