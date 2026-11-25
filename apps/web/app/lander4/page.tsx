import type { Metadata } from "next";
import Link from "next/link";
import { VariantFrame } from "../../components/variant-frame";

export const metadata: Metadata = {
  title: "Enter the node",
  description:
    "A playful way into a synthetic practice. The trainer is the backbone. The signal is drawn.",
  robots: { index: false, follow: false },
};

const FACES = ["DRAWN", "LIT", "NODE", "DEMO", "RANGE", "MAP"] as const;

const STEPS = [
  { href: "/range", label: "Range", line: "A two-second look at a fictional emitter." },
  { href: "/map", label: "Map", line: "The node lights when the skill is yours." },
  { href: "/tiers", label: "Tiers", line: "T4 stays locked. No spoofing in this build." },
] as const;

export default function LanderFourPage() {
  return (
    <VariantFrame variant="lv4" enter={{ href: "/map", label: "Enter the node" }}>
      <section className="lv4-hero">
        <div className="lv4-copy lv4-punch">
          <p className="lv-kicker">AN-ALQ</p>
          <h1>A node you can enter.</h1>
          <p className="lv-sub">
            Playful on the way in. The practice is a synthetic spectrum, and the trainer is the
            backbone.
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
      <p className="lv-note">The cube is a picture of a node. It does not sense a signal.</p>
      <ul className="lv4-steps">
        {STEPS.map((step) => (
          <li key={step.href}>
            <Link href={step.href}>
              <strong>{step.label}</strong>
              <span>{step.line}</span>
            </Link>
          </li>
        ))}
      </ul>
    </VariantFrame>
  );
}
