"use client";

import { useCallback, useMemo, useState } from "react";

type Eip1193Provider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
};

type BuilderStatus = {
  network: "mainnet";
  builder: {
    address: string | null;
    accountID: number | null;
    requestedFeeRate: number;
    requestedFeeBps: number;
    eligibility: {
      spotVusdc: number | null;
      perpsVusdc: number | null;
      eligible: boolean;
    } | null;
  };
  user: {
    address: string;
    accountID: number | null;
    approvedPerps: boolean;
    approvedSpot: boolean;
  } | null;
};

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

function shorten(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function toUniversalSignature(signature: string) {
  const raw = signature.startsWith("0x") ? signature.slice(2) : signature;
  if (!/^[0-9a-fA-F]{130}$/.test(raw)) throw new Error("Wallet returned an invalid signature.");
  const r = raw.slice(0, 64);
  const s = raw.slice(64, 128);
  let v = Number.parseInt(raw.slice(128, 130), 16);
  if (v === 27 || v === 28) v -= 27;
  if (v !== 0 && v !== 1) throw new Error("Wallet returned an invalid recovery byte.");
  return `0x02${r}${s}${v.toString(16).padStart(2, "0")}`;
}

export function BuilderRacePanel() {
  const [address, setAddress] = useState<string | null>(null);
  const [status, setStatus] = useState<BuilderStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async (walletAddress: string) => {
    const res = await fetch(`/api/builder/status?address=${encodeURIComponent(walletAddress)}`, { cache: "no-store" });
    const body = (await res.json()) as BuilderStatus & { error?: string };
    if (!res.ok) throw new Error(body.error || "Could not read SoDEX builder status.");
    setStatus(body);
    return body;
  }, []);

  async function connectWallet() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const provider = window.ethereum;
      if (!provider) throw new Error("No injected EVM wallet found. Open this page in a browser with MetaMask/Rabby or another EIP-1193 wallet.");
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      const account = accounts?.[0];
      if (!account || !/^0x[0-9a-fA-F]{40}$/.test(account)) throw new Error("Wallet did not return a valid address.");
      setAddress(account);
      await refresh(account);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect wallet.");
    } finally {
      setBusy(false);
    }
  }

  async function authorizeBuilder() {
    if (!address || !status?.builder.accountID || !status.user?.accountID) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const provider = window.ethereum;
      if (!provider) throw new Error("Wallet provider is unavailable.");

      const nonce = Date.now();
      const maxFeeRate = status.builder.requestedFeeRate;
      const typedData = {
        domain: {
          name: "universal",
          version: "1",
          chainId: 286623,
          verifyingContract: "0x0000000000000000000000000000000000000000",
        },
        primaryType: "ApproveBuilderFeeAction",
        types: {
          EIP712Domain: [
            { name: "name", type: "string" },
            { name: "version", type: "string" },
            { name: "chainId", type: "uint256" },
            { name: "verifyingContract", type: "address" },
          ],
          ApproveBuilderFeeAction: [
            { name: "chainID", type: "uint64" },
            { name: "nonce", type: "uint64" },
            { name: "accountID", type: "uint64" },
            { name: "builderID", type: "uint64" },
            { name: "maxFeeRate", type: "uint64" },
          ],
        },
        message: {
          chainID: "286623",
          nonce: String(nonce),
          accountID: String(status.user.accountID),
          builderID: String(status.builder.accountID),
          maxFeeRate: String(maxFeeRate),
        },
      };

      const rawSignature = (await provider.request({
        method: "eth_signTypedData_v4",
        params: [address, JSON.stringify(typedData)],
      })) as string;
      const signature = toUniversalSignature(rawSignature);

      const res = await fetch("/api/builder/approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userAddress: address,
          accountID: status.user.accountID,
          builderID: status.builder.accountID,
          maxFeeRate,
          nonce,
          signature,
        }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string; sodex?: unknown };
      if (!res.ok || !body.ok) throw new Error(body.error || "SoDEX rejected the builder authorization.");

      const updated = await refresh(address);
      if (!updated.user?.approvedPerps) throw new Error("Authorization was submitted, but SoDEX has not reported the Perps approval yet.");
      setMessage("PolicyGuard is authorized for SoDEX Perps on mainnet.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Builder authorization failed.");
    } finally {
      setBusy(false);
    }
  }

  const builderReady = Boolean(status?.builder.accountID && status.builder.eligibility?.eligible);
  const userReady = Boolean(status?.user?.accountID);
  const authorized = Boolean(status?.user?.approvedPerps);
  const actionLabel = useMemo(() => {
    if (!address) return "Connect wallet";
    if (!status) return "Check SoDEX status";
    if (!builderReady) return "Builder not eligible yet";
    if (!userReady) return "Activate SoDEX account first";
    if (authorized) return "PolicyGuard authorized";
    return `Authorize PolicyGuard · ${status.builder.requestedFeeBps} bp`;
  }, [address, status, builderReady, userReady, authorized]);

  return (
    <section className="surface-elevated rounded-2xl p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mono text-[11px] uppercase tracking-[0.14em] text-faint">Builder Race · mainnet</p>
          <h2 className="mt-2 text-xl tracking-[-0.03em] text-ink">Authorize PolicyGuard</h2>
          <p className="mt-2 max-w-2xl text-[13px] leading-6 text-muted">
            Connect your wallet, verify your SoDEX mainnet account, then approve PolicyGuard as your Builder. The approval is signed in your wallet; PolicyGuard never receives your private key.
          </p>
        </div>
        <div className="rounded-xl border border-line bg-background/45 px-3 py-2 text-right text-[12px] text-muted">
          <p className="mono uppercase tracking-[0.12em] text-faint">Fee cap requested</p>
          <p className="mt-1 text-sm text-ink">{status ? `${status.builder.requestedFeeBps} bp` : "1 bp"}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatusCard label="Wallet" value={address ? shorten(address) : "Not connected"} ok={Boolean(address)} />
        <StatusCard
          label="Builder ID"
          value={status?.builder.accountID ? String(status.builder.accountID) : "Unresolved"}
          ok={builderReady}
        />
        <StatusCard
          label="SoDEX account"
          value={status?.user?.accountID ? String(status.user.accountID) : "Not detected"}
          ok={userReady}
        />
        <StatusCard label="Perps approval" value={authorized ? "Authorized" : "Not authorized"} ok={authorized} />
      </div>

      {status?.builder.eligibility && (
        <div className="mt-4 rounded-xl border border-line bg-background/40 p-3 text-[12px] text-muted">
          Builder eligibility: Spot vUSDC {status.builder.eligibility.spotVusdc ?? "—"} · Perps vUSDC {status.builder.eligibility.perpsVusdc ?? "—"} · {status.builder.eligibility.eligible ? "eligible" : "needs 100 vUSDC in both"}
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        {!address ? (
          <button type="button" className="btn-primary" disabled={busy} onClick={connectWallet}>
            {busy ? "Connecting…" : actionLabel}
          </button>
        ) : (
          <>
            <button
              type="button"
              className="btn-primary"
              disabled={busy || !builderReady || !userReady || authorized}
              onClick={authorizeBuilder}
            >
              {busy ? "Waiting for wallet…" : actionLabel}
            </button>
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => refresh(address)}>
              Refresh status
            </button>
          </>
        )}
      </div>

      {message && <p className="mt-4 rounded-lg border border-signal/30 bg-signal/10 p-3 text-[13px] text-signal">{message}</p>}
      {error && <p className="mt-4 rounded-lg border border-danger/40 bg-danger/10 p-3 text-[13px] text-danger">{error}</p>}
    </section>
  );
}

function StatusCard({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-background/40 p-3">
      <p className="mono text-[10px] uppercase tracking-[0.12em] text-faint">{label}</p>
      <div className="mt-2 flex items-center gap-2 text-[13px] text-ink">
        <span className={`status-dot ${ok ? "bg-signal" : "bg-faint"}`} />
        <span className="truncate">{value}</span>
      </div>
    </div>
  );
}
