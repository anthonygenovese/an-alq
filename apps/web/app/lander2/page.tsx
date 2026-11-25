// SPDX-License-Identifier: MIT
import type { Metadata } from "next";
import { VariantFrame } from "../../components/variant-frame";

export const metadata: Metadata = {
  title: "Numbered Range",
  description:
    "Start on a synthetic range. Light a node when you earn it. What comes next stands on the trainer.",
  robots: { index: false, follow: false },
};

const STEPS = [
  {
    n: "01",
    name: "Range",
    line: "Name a fictional emitter on a two-second waterfall.",
  },
  {
    n: "02",
    name: "Map",
    line: "A node lights when you show the skill.",
  },
  {
    n: "03",
    name: "Next",
    line: "The trainer stays the backbone as the surface grows.",
  },
] as const;

export default function LanderTwoPage() {
  return (
    <VariantFrame variant="lv2">
      <section className="lv-hero lv-fade">
        <p className="lv-kicker">AN-ALQ</p>
        <h1>From a trainer, a practice.</h1>
        <p className="lv-sub">
          Start on a synthetic range. Light a node when you earn it. What we build next stands on
          that.
        </p>
      </section>
      <div className="lv2-scan" aria-hidden="true">
        <span />
      </div>
      <ol className="lv2-steps">
        {STEPS.map((step) => (
          <li key={step.n}>
            <span className="lv-index">{step.n}</span>
            <div>
              <h2>{step.name}</h2>
              <p>{step.line}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="lv-legend">T4 locked · no spoofing · no live signal</p>
    </VariantFrame>
  );
}
