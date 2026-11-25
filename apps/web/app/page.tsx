// SPDX-License-Identifier: MIT
import type { Metadata } from "next";
import { VariantFrame } from "../components/variant-frame";

export const metadata: Metadata = {
  title: { absolute: "AN-ALQ" },
  description:
    "A business card for the electromagnetic domain. The spectrum is synthetic, and the jamming is practice.",
};

const FACES = ["DRAWN", "LIT", "NODE", "DEMO", "RANGE", "MAP"] as const;

export default function HomePage() {
  return (
    <VariantFrame variant="lv4" enter={{ href: "/map", label: "Enter the node" }}>
      <section className="lv4-hero">
        <div className="lv4-copy lv4-punch">
          <p className="lv-kicker">AN-ALQ</p>
          <h1>Dominate the electromagnetic spectrum.</h1>
          <p className="lv-sub">
            A business card for the electromagnetic domain, where the jamming is practice and the
            waterfall is drawn.
          </p>
        </div>
        <div className="lv4-stage" aria-hidden="true">
          <div className="lv4-cube">
            {FACES.map((face) => (
              <span key={face} className={`lv4-face face-${face.toLowerCase()}`}>
                {face}
              </span>
            ))}
          </div>
        </div>
      </section>
    </VariantFrame>
  );
}
