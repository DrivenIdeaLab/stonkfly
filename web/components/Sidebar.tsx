"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { IconAlert, IconFly, NAV } from "./ui";

export function Sidebar({ source, synthetic }: { source: string; synthetic: boolean }) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 z-20 hidden h-screen w-[228px] shrink-0 flex-col border-r border-line-soft bg-void/40 px-3 py-4 backdrop-blur md:flex">
      <Link href="/" className="mb-6 flex items-center gap-2.5 px-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan/25 bg-cyan/10 text-cyan">
          <IconFly size={17} />
        </span>
        <span className="leading-tight">
          <span className="block text-[0.95rem] font-semibold tracking-tight text-ink">Stonkfly</span>
          <span className="block text-[0.65rem] tracking-[0.16em] text-ink-3 uppercase">Console</span>
        </span>
      </Link>

      <nav className="flex flex-col gap-1">
        {NAV.map(({ href, label, Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link key={href} href={href} className="nav-item" data-active={active}>
              <Icon size={16} className={active ? "text-cyan" : ""} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-2 px-1">
        <div className="rounded-lg border border-line-soft bg-panel/70 p-2.5">
          <div className="label mb-1.5">Data source</div>
          <div className="num text-[0.78rem] text-ink-2">{source}</div>
          {synthetic ? (
            <div className="mt-2 flex items-start gap-1.5 rounded-md border border-amber/25 bg-amber/8 p-1.5 text-[0.68rem] leading-snug text-amber">
              <IconAlert size={13} className="mt-0.5 shrink-0" />
              <span>Synthetic fixture — not market data, not a result.</span>
            </div>
          ) : null}
        </div>
        <p className="px-1 text-[0.65rem] leading-relaxed text-ink-3">
          Read-only observer. The console never writes to a run directory.
        </p>
      </div>
    </aside>
  );
}
