import { BuilderRacePanel } from "@/components/BuilderRacePanel";
import { Shell } from "@/components/Shell";

export default function BuilderPage() {
  return (
    <Shell active="builder">
      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-6 sm:py-10">
        <div className="border-b border-line pb-6">
          <p className="mono text-[12px] uppercase tracking-[0.16em] text-faint">SoSoValue Builder Race</p>
          <h1 className="mt-2 text-3xl tracking-[-0.04em] text-ink sm:text-4xl">Mainnet access</h1>
          <p className="mt-2 max-w-2xl text-[14px] leading-6 text-muted">
            Authorize PolicyGuard as your SoDEX Builder before routing policy-checked mainnet trades. Builder authorization is wallet-signed and can be verified directly against SoDEX.
          </p>
        </div>

        <div className="mt-8">
          <BuilderRacePanel />
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Step number="01" title="Connect" body="Connect the wallet that owns your activated SoDEX mainnet account." />
          <Step number="02" title="Authorize" body="Approve PolicyGuard's Builder ID and 1 bp Perps fee cap with an EIP-712 wallet signature." />
          <Step number="03" title="Trade" body="Once approved, PolicyGuard can attribute eligible mainnet trades to the Builder Race." />
        </div>
      </main>
    </Shell>
  );
}

function Step({ number, title, body }: { number: string; title: string; body: string }) {
  return (
    <div className="surface rounded-xl p-4">
      <p className="mono text-[10px] uppercase tracking-[0.14em] text-faint">{number}</p>
      <p className="mt-2 text-[14px] font-medium text-ink">{title}</p>
      <p className="mt-2 text-[12px] leading-5 text-muted">{body}</p>
    </div>
  );
}
