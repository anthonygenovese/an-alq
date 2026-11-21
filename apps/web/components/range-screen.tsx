"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";

const RangeTrainer = dynamic(() => import("@an-alq/sim/range").then((mod) => mod.RangeTrainer), {
  ssr: false,
  loading: () => <p className="page-fallback">Opening the range…</p>,
});

export function RangeScreen() {
  const params = useSearchParams();
  return <RangeTrainer nodeId={params.get("node")} />;
}
