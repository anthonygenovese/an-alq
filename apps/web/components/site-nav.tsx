// SPDX-License-Identifier: MIT
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import "./node-signal.css";

const LINKS = [
  { href: "/range", label: "Range" },
  { href: "/map", label: "Map" },
  { href: "/tiers", label: "Tiers" },
  { href: "/relay", label: "Relay" },
] as const;

const NODE_SIGNAL = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export function SiteNav() {
  const pathname = usePathname();
  const showSurfaceLinks = pathname !== "/";
  return (
    <header className="nav">
      <Link href="/" className="brand-link">
        <p className="brand-mark">AN-ALQ</p>
        <p className="brand-sub brand-sub-live">
          Nodes · synthetic spectrum
          <span className="node-signal" aria-hidden="true">
            <span className="node-signal-dot" />
            <span className="node-signal-bars">
              {NODE_SIGNAL.map((bar) => (
                <span key={bar} />
              ))}
            </span>
          </span>
        </p>
      </Link>
      {showSurfaceLinks ? (
        <nav className="nav-links" aria-label="Surfaces">
          {LINKS.map((link) => {
            const current = pathname === link.href;
            return (
              <Link key={link.href} href={link.href} aria-current={current ? "page" : undefined}>
                {link.label}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </header>
  );
}
