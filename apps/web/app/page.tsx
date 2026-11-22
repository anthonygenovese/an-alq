import type { Metadata } from "next";
import Link from "next/link";
import { ChartMark } from "../components/chart-mark";

export const metadata: Metadata = {
  title: "AN-ALQ",
  description: "Range trainer, skill map, and a relay board in demo mode.",
};

export default function HomePage() {
  return (
    <main className="landing">
      <section>
        <p className="eyebrow">AN-ALQ</p>
        <h1>Range, map, relay.</h1>
        <p className="lede">
          A console for the Tier 1 trainer, the skill map, and the signal relay. The waterfall is
          synthetic. Every quantitative figure is illustrative. A node you have mastered is a lit
          node. Scores stay in local storage on this device.
        </p>
        <div className="actions">
          <Link href="/range">Open the range</Link>
          <Link href="/map">Skill map</Link>
          <Link href="/relay">Relay demo</Link>
        </div>
        <ul className="facts">
          <li>
            <strong>Range</strong>
            <span>Name a fictional emitter on a time-compressed waterfall.</span>
          </li>
          <li>
            <strong>Map</strong>
            <span>
              Six sectors. T1 nodes can light. After T1, definition nodes and the fictional grid can
              become lit nodes. Spot, RGPO, VGPO, and T4 stay locked.
            </span>
          </li>
          <li>
            <strong>Relay</strong>
            <span>Demo fixtures only. Nothing is posted and no mailbox is read.</span>
          </li>
        </ul>
      </section>
      <ChartMark />
    </main>
  );
}
