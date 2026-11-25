// SPDX-License-Identifier: MIT
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="landing">
      <section>
        <p className="eyebrow">404</p>
        <h1>No such surface.</h1>
        <p className="lede">
          The range, the skill map, and the relay demo are the pages in this shell.
        </p>
        <div className="actions">
          <Link href="/">Back to the console</Link>
        </div>
      </section>
    </main>
  );
}
