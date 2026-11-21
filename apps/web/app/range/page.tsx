import { Suspense } from "react";
import type { Metadata } from "next";
import { RangeScreen } from "../../components/range-screen";

export const metadata: Metadata = {
  title: "T1 range",
  description: "Synthetic waterfall. Name the fictional emitter.",
};

export default function RangePage() {
  return (
    <Suspense fallback={<p className="page-fallback">Opening the range…</p>}>
      <RangeScreen />
    </Suspense>
  );
}
