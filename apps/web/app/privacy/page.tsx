// SPDX-License-Identifier: MIT
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What this web shell stores, and what it does not.",
};

export default function PrivacyPage() {
  return (
    <main className="landing privacy">
      <section>
        <p className="eyebrow">AN-ALQ</p>
        <h1>Privacy</h1>
        <p className="lede">Last updated 24 November 2026.</p>
        <p>
          This site is a demonstration. The waterfall is synthetic. Quantitative figures are
          illustrative. It is not a radio, it does not post, and it is not legal, financial,
          medical, or government advice. There is no account and no contact form.
        </p>

        <h2>Analytics</h2>
        <p>
          The site uses Vercel Web Analytics. That measurement is cookieless. It records aggregate
          page views and visits. It does not build a personal profile, and it does not set a cookie
          for analytics.
        </p>

        <h2>On this device</h2>
        <p>
          A few records stay in this browser&apos;s local storage. They are not sent to this site.
          Clearing site data removes them.
        </p>
        <ul>
          <li>
            <code>an-alq.theme</code> is <code>light</code> or <code>dark</code>, and only after you
            choose. Until then the page follows the system preference and does not write a choice.
          </li>
          <li>
            <code>an-alq.skill-evidence.v1</code> holds attempt counts, correct counts, and summed
            reaction time, keyed by fictional category and difficulty.
          </li>
          <li>
            <code>an-alq.skill-acknowledgment.v1</code> holds two booleans for the glossary nodes.
          </li>
          <li>
            <code>an-alq.tier-evidence.v1</code> holds attempt counts, correct counts, and elapsed
            time for the fictional grid and the definition nodes.
          </li>
          <li>
            <code>an-alq.tier-acknowledgment.v1</code> holds booleans for those same nodes.
          </li>
        </ul>
        <p>Extra keys in those records, including a name or an email, are dropped on load.</p>

        <h2>Relay</h2>
        <p>
          The relay page requests <code>/api/relay/snapshot</code> on this same site. The request
          has no body and no name. The response is public alert text, or demo fixtures when no live
          source is configured. The page does not read a mailbox and it does not post.
        </p>

        <h2>What this site does not collect</h2>
        <p>
          There is no form. The pages do not ask for a name, an email, a phone number, or an
          address. They do not write a visitor log. The cron and ingest routes are not pages you
          fill in.
        </p>
        <p>
          A problem with this site can be reported through the repository&apos;s{" "}
          <a href="https://github.com/anthonygenovese/an-alq/security/advisories/new">
            private vulnerability reporting
          </a>
          . There is no email address for this page.
        </p>
        <div className="actions">
          <Link href="/">Back to the console</Link>
        </div>
      </section>
    </main>
  );
}
