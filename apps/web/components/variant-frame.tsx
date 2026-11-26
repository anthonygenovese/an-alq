// SPDX-License-Identifier: MIT
import type { ReactNode } from "react";
import Link from "next/link";
import { TRAINING_DISCLAIMER } from "@an-alq/emitters";
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
  surfaces = true,
  children,
}: {
  variant: "lv1" | "lv2" | "lv3" | "lv4";
  enter?: { href: string; label: string };
  surfaces?: boolean;
  children: ReactNode;
}) {
  return (
    <main className={`lv ${variant}`}>
      {enter ? (
        <div className="lv-tools">
          <Link className="lv-enter" href={enter.href}>
            {enter.label}
          </Link>
        </div>
      ) : null}
      {children}
      <footer className="lv-foot">
        <p>{TRAINING_DISCLAIMER}</p>
        <nav aria-label={surfaces ? "Surfaces and privacy" : "Privacy"}>
          {surfaces
            ? SURFACES.map((link) => (
                <Link key={link.href} href={link.href}>
                  {link.label}
                </Link>
              ))
            : null}
          <Link href="/privacy">Privacy</Link>
        </nav>
      </footer>
    </main>
  );
}
