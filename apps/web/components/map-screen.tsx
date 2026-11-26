// SPDX-License-Identifier: MIT
"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";

const SkillMapScreen = dynamic(() => import("@an-alq/sim/map").then((mod) => mod.SkillMapScreen), {
  ssr: false,
  loading: () => <p className="page-fallback">Opening the map…</p>,
});

export function MapScreen() {
  const router = useRouter();
  return (
    <SkillMapScreen
      onEnterRange={(nodeId) => {
        router.push(`/range?node=${encodeURIComponent(nodeId)}`);
      }}
    />
  );
}
