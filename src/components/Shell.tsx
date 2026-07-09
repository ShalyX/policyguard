import Link from "next/link";

export function Shell({
  children,
  active,
}: {
  children: React.ReactNode;
  active?: "home" | "desk" | "receipt";
}) {
  return (
    <div className="min-h-screen bg-background text-ink">
      <header className="sticky top-0 z-40 border-b border-line bg-[#08090a]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent-deep text-[11px] font-semibold text-white">
              P
            </span>
            <span className="text-[15px] font-medium tracking-[-0.02em] text-ink">PolicyGuard</span>
          </Link>
          <nav className="hidden items-center gap-7 text-[13px] text-muted sm:flex">
            <Link href="/" className={active === "home" ? "text-ink" : "hover:text-ink"}>
              Product
            </Link>
            <Link href="/desk" className={active === "desk" ? "text-ink" : "hover:text-ink"}>
              Desk
            </Link>
            <a href="https://github.com/ShalyX/policyguard" target="_blank" rel="noreferrer" className="hover:text-ink">
              GitHub
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/desk" className="btn-primary !px-3.5 !py-2 text-[13px]">
              Open desk
            </Link>
          </div>
        </div>
      </header>
      {children}
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-[13px] text-faint sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>Pre-trade policy gateway for autonomous SoDEX agents.</p>
          <p className="mono">SoSoValue · SoDEX testnet · audit receipts</p>
        </div>
      </footer>
    </div>
  );
}
