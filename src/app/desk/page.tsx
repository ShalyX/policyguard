"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Shell } from "@/components/Shell";
import { ReceiptView } from "@/components/ReceiptView";
import type { PolicyReceipt } from "@/lib/types";

type ReceiptResponse = PolicyReceipt & { sharePacket?: string };

type Health = {
  ok: boolean;
  integrations?: {
    sosovalueConfigured?: boolean;
    sodex?: {
      submitEnabled?: boolean;
      credentialsConfigured?: boolean;
      signMode?: string;
    };
  };
};

export default function DeskPage() {
  const [receipt, setReceipt] = useState<ReceiptResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [asset, setAsset] = useState("BTC");
  const [side, setSide] = useState("LONG");
  const [notionalUsd, setNotionalUsd] = useState(25);
  const [leverage, setLeverage] = useState(1);
  const [sourceAgent, setSourceAgent] = useState("desk-agent");
  const [thesis, setThesis] = useState(
    "ETF inflows and positive market momentum support a continuation trade, but PolicyGuard must check sizing, news conflict, and SoDEX readiness before execution.",
  );
  const [confirmSubmit, setConfirmSubmit] = useState(true);
  const [maxNotionalUsd, setMaxNotionalUsd] = useState(1500);
  const [maxLeverage, setMaxLeverage] = useState(3);
  const [requireHumanConfirmation, setRequireHumanConfirmation] = useState(false);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth({ ok: false }));
  }, []);

  const payload = useMemo(
    () => ({
      asset,
      side,
      notionalUsd,
      leverage,
      thesis,
      sourceAgent,
      confirmSubmit,
      userPolicy: { maxNotionalUsd, maxLeverage, requireHumanConfirmation },
    }),
    [asset, side, notionalUsd, leverage, thesis, sourceAgent, confirmSubmit, maxNotionalUsd, maxLeverage, requireHumanConfirmation],
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setReceipt(null);
    try {
      const res = await fetch("/api/preflight", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || body.error || "preflight_failed");
      setReceipt(body);
      requestAnimationFrame(() => {
        document.getElementById("receipt-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  const sodex = health?.integrations?.sodex;
  const shareHref = receipt
    ? `/receipts/${receipt.id}${receipt.sharePacket ? `?packet=${receipt.sharePacket}` : ""}`
    : undefined;

  return (
    <Shell active="desk">
      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
          <div>
            <p className="mono text-[12px] uppercase tracking-[0.16em] text-faint">Operator desk</p>
            <h1 className="mt-2 text-3xl tracking-[-0.04em] text-ink sm:text-4xl">Preflight</h1>
            <p className="mt-2 max-w-xl text-[14px] leading-6 text-muted">
              Submit a proposed order. PolicyGuard returns a verdict, approved size, and SoDEX execution status.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-[12px]">
            <Pill on={Boolean(health?.integrations?.sosovalueConfigured)} label="SoSoValue" />
            <Pill on={Boolean(sodex?.credentialsConfigured)} label="SoDEX creds" />
            <Pill on={Boolean(sodex?.submitEnabled)} label={`Submit ${sodex?.signMode ?? "—"}`} />
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
          <form onSubmit={submit} className="surface-elevated rounded-2xl p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[15px] font-medium text-ink">Proposed order</h2>
              <span className="mono text-[11px] uppercase tracking-[0.14em] text-faint">agent intake</span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Field label="Asset">
                <select className="field" value={asset} onChange={(e) => setAsset(e.target.value)}>
                  <option>BTC</option>
                  <option>ETH</option>
                  <option>SOL</option>
                </select>
              </Field>
              <Field label="Side">
                <select className="field" value={side} onChange={(e) => setSide(e.target.value)}>
                  <option>LONG</option>
                  <option>SHORT</option>
                </select>
              </Field>
              <Field label="Notional USD">
                <input
                  className="field"
                  type="number"
                  min={1}
                  value={notionalUsd}
                  onChange={(e) => setNotionalUsd(Number(e.target.value))}
                />
              </Field>
              <Field label="Leverage">
                <input
                  className="field"
                  type="number"
                  min={1}
                  max={20}
                  value={leverage}
                  onChange={(e) => setLeverage(Number(e.target.value))}
                />
              </Field>
              <Field label="Max notional">
                <input
                  className="field"
                  type="number"
                  value={maxNotionalUsd}
                  onChange={(e) => setMaxNotionalUsd(Number(e.target.value))}
                />
              </Field>
              <Field label="Max leverage">
                <input
                  className="field"
                  type="number"
                  value={maxLeverage}
                  onChange={(e) => setMaxLeverage(Number(e.target.value))}
                />
              </Field>
            </div>

            <div className="mt-3">
              <Field label="Source agent">
                <input className="field" value={sourceAgent} onChange={(e) => setSourceAgent(e.target.value)} />
              </Field>
            </div>

            <div className="mt-3">
              <Field label="Thesis">
                <textarea
                  className="field min-h-28 resize-y"
                  value={thesis}
                  onChange={(e) => setThesis(e.target.value)}
                  rows={5}
                />
              </Field>
            </div>

            <div className="mt-4 space-y-2 rounded-xl border border-line bg-background/40 p-3">
              <label className="flex items-start gap-3 text-[13px] text-muted">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={confirmSubmit}
                  onChange={(e) => setConfirmSubmit(e.target.checked)}
                />
                <span>
                  Confirm SoDEX testnet submit after policy gate. Without credentials the order stays prepared.
                </span>
              </label>
              <label className="flex items-start gap-3 text-[13px] text-muted">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={requireHumanConfirmation}
                  onChange={(e) => setRequireHumanConfirmation(e.target.checked)}
                />
                <span>Require human confirmation in policy (forces escalate unless confirm is also set).</span>
              </label>
            </div>

            <button type="submit" disabled={loading} className="btn-primary mt-5 w-full">
              {loading ? "Running policy + SoDEX…" : "Run preflight"}
            </button>
            {error && (
              <p className="mt-3 max-h-28 overflow-auto break-words rounded-lg border border-danger/40 bg-danger/10 p-3 text-[13px] text-danger">
                {error}
              </p>
            )}
          </form>

          <div id="receipt-panel" className="surface-elevated min-h-[32rem] rounded-2xl p-5 sm:p-6">
            {!receipt ? (
              <div className="flex h-full min-h-[28rem] flex-col items-center justify-center text-center">
                <div className="gate-visual h-28 w-full max-w-sm rounded-xl border border-line" />
                <p className="mt-6 text-[15px] text-ink">No receipt yet</p>
                <p className="mt-2 max-w-sm text-[13px] leading-6 text-muted">
                  Run a preflight to generate a policy verdict and SoDEX execution record.
                </p>
              </div>
            ) : (
              <ReceiptView receipt={receipt} shareHref={shareHref} compact />
            )}
          </div>
        </div>
      </main>
    </Shell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-[12px] text-muted">
      <span className="mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

function Pill({ on, label }: { on: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-line bg-background/50 px-3 py-1.5 text-muted">
      <span className={`status-dot ${on ? "bg-signal" : "bg-faint"}`} />
      {label}
    </span>
  );
}
