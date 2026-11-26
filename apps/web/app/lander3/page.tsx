// SPDX-License-Identifier: MIT
import type { Metadata } from "next";
import { VariantFrame } from "../../components/variant-frame";

export const metadata: Metadata = {
  title: "Synthetic Overlay",
  description:
    "Electromagnetic practice, built in the open, trained on a drawn signal. Serious about the limits.",
  robots: { index: false, follow: false },
};

const READOUT = "SYNTHETIC  ·  DRAWN SIGNAL  ·  ILLUSTRATIVE  ·  DEMO  ·  ";

const BLOCKS = [
  {
    n: "01",
    name: "Practice",
    line: "Enter the range and name a fictional emitter on a waterfall that was drawn, not received.",
  },
  {
    n: "02",
    name: "Backbone",
    line: "The trainer carries the work. Later surfaces stand on nodes you have lit on this device.",
  },
  {
    n: "03",
    name: "Honest limits",
    line: "Spot, RGPO, and VGPO stay locked. T4 has no spoofing. There is no live signal, and the relay is a demo.",
  },
] as const;

export default function LanderThreePage() {
  return (
    <VariantFrame variant="lv3">
      <div className="lv3-overlay" aria-hidden="true">
        <span className="lv3-bracket tl" />
        <span className="lv3-bracket tr" />
        <span className="lv3-bracket bl" />
        <span className="lv3-bracket br" />
        <div className="lv3-ticks">
          {Array.from({ length: 8 }, (_, index) => (
            <span key={index} style={{ width: `${28 + (index % 4) * 14}px` }} />
          ))}
        </div>
        <div className="lv3-grain" />
      </div>
      <section className="lv-hero lv-fade">
        <p className="lv-kicker">AN-ALQ</p>
        <h1>The spectrum, on a range.</h1>
        <p className="lv-sub">
          Electromagnetic practice, built in the open, trained on a drawn signal. Fun to enter.
          Serious about the limits.
        </p>
      </section>
      <div className="lv3-crawl" aria-hidden="true">
        <p>
          {READOUT}
          {READOUT}
        </p>
      </div>
      <ol className="lv3-blocks">
        {BLOCKS.map((block) => (
          <li key={block.n}>
            <span className="lv-mono">{block.n}</span>
            <h2>{block.name}</h2>
            <p>{block.line}</p>
          </li>
        ))}
      </ol>
    </VariantFrame>
  );
}
