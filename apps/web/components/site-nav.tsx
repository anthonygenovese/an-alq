"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/range", label: "Range" },
  { href: "/map", label: "Map" },
  { href: "/relay", label: "Relay" },
] as const;

export function SiteNav() {
  const pathname = usePathname();
  return (
    <header className="nav">
      <Link href="/" className="brand-link">
        <p className="brand-mark">AN-ALQ</p>
        <p className="brand-sub">Nodes · synthetic spectrum</p>
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
