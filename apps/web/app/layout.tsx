// SPDX-License-Identifier: MIT
import type { Metadata } from "next";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import { SiteNav } from "../components/site-nav";
import { ThemeToggle } from "../components/theme-toggle";
import { themeBootScript } from "../theme";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "AN-ALQ",
    template: "%s · AN-ALQ",
  },
  description:
    "Illustrative figures, a synthetic waterfall, and skill-map nodes. Progress stays on this device.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <ThemeToggle />
        <div className="shell">
          <SiteNav />
          <div className="shell-main">{children}</div>
          <footer className="site-footer">
            <Link href="/privacy">Privacy</Link>
          </footer>
        </div>
        <Analytics />
      </body>
    </html>
  );
}
