// SPDX-License-Identifier: MIT
import type { Metadata } from "next";
import Link from "next/link";
import { ChartMark } from "../../components/chart-mark";
import { VariantFrame } from "../../components/variant-frame";

export const metadata: Metadata = {
  title: "One Glance",
  description:
    "Practice the spectrum. The trainer is the backbone. The waterfall is drawn and every figure is illustrative.",
  robots: { index: false, follow: false },
};

const PROOF = [
  { name: "Range", line: "Name a fictional emitter." },
  { name: "Map", line: "A node lights when you show the skill." },
  { name: "Tiers", line: "The trainer is the path you walk." },
] as const;

export default function LanderOnePage() {
  return (
    <VariantFrame variant="lv1">
      <section className="lv1-hero">
        <div className="lv-fade">
          <p className="lv-wordmark">AN-ALQ</p>
          <h1>Practice the spectrum.</h1>
          <p className="lv-sub">
            A development in electromagnetic skill. The trainer is the backbone. The waterfall is
            drawn; every figure is illustrative.
          </p>
          <Link className="lv-cta" href="/range">
            Open the range
          </Link>
          <p className="lv-status lv-fade lv-fade-late">SYNTHETIC · ILLUSTRATIVE · DEMO</p>
        </div>
        <div className="lv1-wash lv-fade lv-fade-late" aria-hidden="true">
          <ChartMark />
        </div>
      </section>
      <ul className="lv-proof lv-fade lv-fade-late">
        {PROOF.map((item) => (
          <li key={item.name}>
            <strong>{item.name}</strong>
            <span>{item.line}</span>
          </li>
        ))}
      </ul>
      <p className="lv-note">
        The trainer is the backbone. What AN-ALQ becomes across the spectrum still stands on that
        practice.
      </p>
    </VariantFrame>
  );
}
