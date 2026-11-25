// SPDX-License-Identifier: MIT
import type { Metadata } from "next";
import { MapScreen } from "../../components/map-screen";

export const metadata: Metadata = {
  title: "Skill map",
  description: "Skill-map nodes. Lit nodes stay on this device.",
};

export default function MapPage() {
  return <MapScreen />;
}
