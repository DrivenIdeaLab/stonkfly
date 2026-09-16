"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV } from "./ui";

/**
 * Phones get a horizontal scrollable nav strip instead of the sidebar
 * (which is hidden below md). The KPI grid and the network-input image
 * are the panels that must keep reading well at ~390px.
 */
export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="sticky top-0 z-20 flex items-center gap-1 overflow-x-auto border-b border-line-soft bg-void/80 px-3 py-2 backdrop-blur md:hidden">
      {NAV.map(({ href, label }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`whitespace-nowrap rounded-md px-2.5 py-1 text-[0.78rem] ${
              active ? "bg-cyan/10 text-cyan" : "text-ink-3"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
