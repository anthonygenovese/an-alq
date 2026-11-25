"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/range", label: "Range" },
  { href: "/map", label: "Map" },
  { href: "/tiers", label: "Tiers" },
  { href: "/relay", label: "Relay" },
] as const;

const METER = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export function SiteNav() {
  const pathname = usePathname();
  const showMeter = pathname === "/lander4";
  return (
    <header className="nav">
      <Link href="/" className="brand-link">
        <p className="brand-mark">AN-ALQ</p>
        <p className={showMeter ? "brand-sub brand-sub-live" : "brand-sub"}>
          Nodes · synthetic spectrum
          {showMeter ? (
            <span className="lv4-meter" aria-hidden="true">
              <span className="lv4-meter-dot" />
              <span className="lv4-meter-bars">
                {METER.map((bar) => (
                  <span key={bar} />
                ))}
              </span>
            </span>
          ) : null}
        </p>
      </Link>
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
    </header>
  );
}
