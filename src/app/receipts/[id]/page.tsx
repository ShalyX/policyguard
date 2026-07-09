import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell } from "@/components/Shell";
import { ReceiptView } from "@/components/ReceiptView";
import { getReceipt } from "@/lib/store";

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
    <Shell active="receipt">
      <main className="mx-auto max-w-4xl px-5 py-8 sm:px-6 sm:py-10">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link href="/desk" className="text-[13px] text-muted hover:text-ink">
            ← Back to desk
          </Link>
          <span className="mono text-[11px] uppercase tracking-[0.16em] text-faint">Public record</span>
        </div>
        <article className="surface-elevated rounded-2xl p-5 sm:p-8">
          <ReceiptView receipt={receipt} />
        </article>
      </main>
    </Shell>
  );
}
