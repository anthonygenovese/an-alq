import type { ReactNode } from "react";
import Link from "next/link";
import { TRAINING_DISCLAIMER } from "@an-alq/emitters";
import { ThemeToggle } from "./theme-toggle";
import "./lander-variants.css";

const SURFACES = [
  { href: "/range", label: "Range" },
  { href: "/map", label: "Map" },
  { href: "/tiers", label: "Tiers" },
  { href: "/relay", label: "Relay demo" },
] as const;

export function VariantFrame({
  variant,
  enter,
  children,
}: {
  variant: "lv1" | "lv2" | "lv3" | "lv4";
  enter?: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <main className={`lv ${variant}`}>
      <div className="lv-tools">
        <ThemeToggle />
        {enter ? (
          <Link className="lv-enter" href={enter.href}>
            {enter.label}
          </Link>
        ) : null}
      </div>
      {children}
      <footer className="lv-foot">
        <p>{TRAINING_DISCLAIMER}</p>
        <nav aria-label="Surfaces and privacy">
          {SURFACES.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
          <Link href="/privacy">Privacy</Link>
        </nav>
      </footer>
    </main>
  );
}
