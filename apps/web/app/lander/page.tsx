import type { Metadata } from "next";
import Link from "next/link";
import { TRAINING_DISCLAIMER } from "@an-alq/emitters";
import { ChartMark } from "../../components/chart-mark";
import { ThemeToggle } from "../../components/theme-toggle";

export const metadata: Metadata = {
  title: "Overview",
  description:
    "Cybersecurity and electronic-warfare trainer. Synthetic spectrum. Illustrative figures. Scores stay on this device.",
};

export default function LanderPage() {
  return (
    <main className="lander">
      <div className="landing">
        <section>
          <div className="landing-tools">
            <p className="eyebrow">AN-ALQ</p>
            <ThemeToggle />
          </div>
          <h1>A trainer for a synthetic spectrum.</h1>
          <p className="lede">
            Cybersecurity and electronic-warfare practice for the range, the skill map, and the
            tiers. A node you have mastered is a lit node. Scores stay in local storage on this
            device.
          </p>
          <p className="lede">{TRAINING_DISCLAIMER}</p>
          <div className="actions">
            <Link href="/range">Open the range</Link>
            <Link href="/map">Skill map</Link>
            <Link href="/tiers">Tiers</Link>
          </div>
        </section>
        <ChartMark />
      </div>

      <section className="lander-section" aria-labelledby="train-on">
        <h2 id="train-on">What you train on</h2>
        <ul className="facts">
          <li>
            <strong>Range</strong>
            <span>
              Name a fictional emitter on a time-compressed synthetic waterfall. The window is two
              seconds. Frequency, PRI, and SNR are illustrative.
            </span>
          </li>
          <li>
            <strong>Map</strong>
            <span>
              Six sectors. Items are nodes. A node you have mastered, and whose required nodes are
              already lit, becomes a lit node. The record stays on this device.
            </span>
          </li>
          <li>
            <strong>Tiers</strong>
            <span>
              T1 spectral classify is playable. T2 is a fictional grid and a TDOA definition. T3
              barrage and FHSS are glossary definitions. T4 stays locked. T5 collateral is a
              fictional board label.
            </span>
          </li>
        </ul>
      </section>

      <section className="lander-section" aria-labelledby="safety-stance">
        <h2 id="safety-stance">How it stays a trainer</h2>
        <p>
          Safety is the floor, built into the map. Evaluation is the lit node: the map does not
          light a skill you have not shown. This site is a demonstration. It is not legal,
          financial, medical, or government advice.
        </p>
        <ul className="facts stack">
          <li>
            <strong>No live spectrum</strong>
            <span>
              The waterfall is drawn. The trainer does not open a radio, and it does not sense, jam,
              spoof, locate, or engage anything.
            </span>
          </li>
          <li>
            <strong>Spot, RGPO, and VGPO stay locked</strong>
            <span>
              Those nodes stay locked. Barrage and FHSS are glossary definitions. There is no
              transmitter.
            </span>
          </li>
          <li>
            <strong>T4 has no spoofing</strong>
            <span>Deception decisions stay locked. This build has no spoofing content.</span>
          </li>
          <li>
            <strong>No fix</strong>
            <span>
              T2 picks a cell on a fictional grid or reads a TDOA definition. AOA stays locked.
              There are no coordinates and no fix.
            </span>
          </li>
          <li>
            <strong>Relay demo</strong>
            <span>Demo fixtures only. Nothing is posted and no mailbox is read.</span>
          </li>
        </ul>
      </section>

      <section className="lander-section" aria-labelledby="privacy-note">
        <h2 id="privacy-note">Privacy</h2>
        <p>
          Vercel Web Analytics is cookieless. It records aggregate page views and visits. It does
          not build a personal profile, and it does not set a cookie for analytics. There is no form
          and no sign-up. Attempt counts stay in this browser and are not sent to the server.
        </p>
        <p>
          <Link href="/privacy">Read the privacy note</Link>
        </p>
      </section>

      <section className="lander-section" aria-labelledby="open-surface">
        <h2 id="open-surface">Open a surface</h2>
        <p>The trainer is already in the shell. These links open the existing pages.</p>
        <div className="actions">
          <Link href="/range">Open the range</Link>
          <Link href="/map">Skill map</Link>
          <Link href="/tiers">Tiers</Link>
          <Link href="/relay">Relay demo</Link>
          <Link href="/privacy">Privacy</Link>
        </div>
      </section>
    </main>
  );
}
