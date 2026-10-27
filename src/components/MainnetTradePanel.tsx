"use client";

import { FormEvent, useMemo, useState } from "react";

type Eip1193Provider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
};

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

type PrepareResponse = {
  readyToSign?: boolean;
  error?: string;
  message?: string;
  decision?: {
    id: string;
    verdict: string;
    approvedNotionalUsd: number;
    reasons: string[];
  };
  preparedOrder?: {
    market: string;
    clientOrderId: string;
    accountID: number;
    approvedNotionalUsd: number;
    builder: { id: number; fee: number };
    payloadHash: string;
  };
  signing?: {
    typedData: Record<string, unknown>;
    executionToken: string;
    expiresAt: number;
  };
};

type SubmitResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  builder?: { id: number; fee: number };
  payloadHash?: string;
  sodex?: unknown;
};

function short(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function MainnetTradePanel() {
  const [address, setAddress] = useState<string | null>(null);
  const [asset, setAsset] = useState("BTC");
  const [side, setSide] = useState("LONG");
  const [notionalUsd, setNotionalUsd] = useState(10);
  const [maxNotionalUsd, setMaxNotionalUsd] = useState(100);
  const [leverage, setLeverage] = useState(1);
  const [maxLeverage, setMaxLeverage] = useState(3);
  const [thesis, setThesis] = useState("PolicyGuard mainnet Builder Race trade after user authorization and policy checks.");
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ prepare: PrepareResponse; submit: SubmitResponse } | null>(null);

  const payload = useMemo(
    () => ({
      asset,
      side,
      notionalUsd,
      leverage,
      thesis,
      sourceAgent: "builder-race-wallet",
      confirmSubmit: true,
      userPolicy: {
        maxNotionalUsd,
        maxLeverage,
        requireHumanConfirmation: true,
      },
    }),
    [asset, side, notionalUsd, leverage, thesis, maxNotionalUsd, maxLeverage],
  );

  async function connect() {
    setError(null);
    const provider = window.ethereum;
    if (!provider) {
      setError("No injected EVM wallet found. Use a browser with MetaMask, Rabby, or another EIP-1193 wallet.");
      return;
    }
    try {
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      const account = accounts?.[0];
      if (!account || !/^0x[0-9a-fA-F]{40}$/.test(account)) throw new Error("Wallet returned an invalid address.");
      setAddress(account);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect wallet.");
    }
  }

  async function trade(event: FormEvent) {
    event.preventDefault();
    if (!address || !acknowledged) return;
    const provider = window.ethereum;
    if (!provider) return;

    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const prepareRes = await fetch("/api/mainnet/prepare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userAddress: address, ...payload }),
      });
      const prepare = (await prepareRes.json()) as PrepareResponse;
      if (!prepareRes.ok) throw new Error(prepare.message || prepare.error || "Mainnet order preparation failed.");
      if (!prepare.readyToSign || !prepare.signing) {
        throw new Error(prepare.message || `Policy verdict: ${prepare.decision?.verdict ?? "not approved"}.`);
      }

      const signature = (await provider.request({
        method: "eth_signTypedData_v4",
        params: [address, JSON.stringify(prepare.signing.typedData)],
      })) as string;
      if (!/^0x[0-9a-fA-F]{130}$/.test(signature)) throw new Error("Wallet returned an invalid trade signature.");

      const submitRes = await fetch("/api/mainnet/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ executionToken: prepare.signing.executionToken, signature }),
      });
      const submit = (await submitRes.json()) as SubmitResponse;
      if (!submitRes.ok || !submit.ok) throw new Error(submit.message || submit.error || "SoDEX mainnet rejected the trade.");
      setResult({ prepare, submit });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mainnet trade failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="surface-elevated rounded-2xl p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mono text-[11px] uppercase tracking-[0.14em] text-faint">Real mainnet execution</p>
          <h2 className="mt-2 text-xl tracking-[-0.03em] text-ink">Policy-checked Builder trade</h2>
          <p className="mt-2 max-w-2xl text-[13px] leading-6 text-muted">
            This flow prepares the exact SoDEX order on the server, binds it to the policy decision and PolicyGuard Builder ID, then asks your wallet to sign that exact payload.
          </p>
        </div>
        <button type="button" onClick={connect} className={address ? "btn-ghost" : "btn-primary"} disabled={busy}>
          {address ? short(address) : "Connect wallet"}
        </button>
      </div>

      <form className="mt-6" onSubmit={trade}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Asset">
            <select className="field" value={asset} onChange={(e) => setAsset(e.target.value)}>
              <option>BTC</option><option>ETH</option><option>SOL</option>
            </select>
          </Field>
          <Field label="Side">
            <select className="field" value={side} onChange={(e) => setSide(e.target.value)}>
              <option>LONG</option><option>SHORT</option>
            </select>
          </Field>
          <Field label="Notional USD">
            <input className="field" type="number" min={10} value={notionalUsd} onChange={(e) => setNotionalUsd(Number(e.target.value))} />
          </Field>
          <Field label="Policy leverage">
            <input className="field" type="number" min={1} max={20} value={leverage} onChange={(e) => setLeverage(Number(e.target.value))} />
          </Field>
          <Field label="Max notional">
            <input className="field" type="number" min={10} value={maxNotionalUsd} onChange={(e) => setMaxNotionalUsd(Number(e.target.value))} />
          </Field>
          <Field label="Max leverage">
            <input className="field" type="number" min={1} max={20} value={maxLeverage} onChange={(e) => setMaxLeverage(Number(e.target.value))} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Trade thesis">
              <input className="field" value={thesis} onChange={(e) => setThesis(e.target.value)} />
            </Field>
          </div>
        </div>

        <label className="mt-5 flex items-start gap-3 rounded-xl border border-caution/30 bg-caution/5 p-3 text-[12px] leading-5 text-muted">
          <input className="mt-1" type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} />
          <span>
            I understand this is SoDEX <strong className="text-ink">mainnet</strong> and, after my wallet signature, PolicyGuard will submit a real order using funds in my SoDEX account. The Builder fee requested is 1 bp unless the app configuration changes.
          </span>
        </label>

        <button className="btn-primary mt-5" type="submit" disabled={busy || !address || !acknowledged}>
          {busy ? "Policy check + wallet signature…" : "Review, sign & submit mainnet trade"}
        </button>
      </form>

      {result && (
        <div className="mt-5 rounded-xl border border-signal/30 bg-signal/10 p-4 text-[13px] text-ink">
          <p className="font-medium">Mainnet order submitted with PolicyGuard Builder attribution.</p>
          <p className="mt-2 text-muted">
            Verdict {result.prepare.decision?.verdict} · approved ${result.prepare.decision?.approvedNotionalUsd} · Builder ID {result.submit.builder?.id} · fee {(result.submit.builder?.fee ?? 0) / 10} bp
          </p>
          <p className="mono mt-2 break-all text-[11px] text-faint">{result.submit.payloadHash}</p>
        </div>
      )}
      {error && <p className="mt-5 rounded-lg border border-danger/40 bg-danger/10 p-3 text-[13px] text-danger">{error}</p>}
    </section>
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
