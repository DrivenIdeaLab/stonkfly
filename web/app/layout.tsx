import type { Metadata, Viewport } from "next";

import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { sourceKind } from "@/lib/source";

import "./globals.css";

export const metadata: Metadata = {
  title: "Stonkfly Console",
  description: "Read-only observability console for the Stonkfly connectome trading experiment",
};

export const viewport: Viewport = {
  themeColor: "#0a0e15",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const source = sourceKind();
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <div className="relative z-10 flex min-h-screen">
          <Sidebar source={source} synthetic={source === "fixture"} />
          <div className="min-w-0 flex-1">
            <MobileNav />
            <main className="px-4 py-5 md:px-7 md:py-7">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
