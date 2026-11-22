import type { Metadata } from "next";
import { TiersScreen } from "../../components/tiers-screen";

export const metadata: Metadata = {
  title: "Tiers",
  description: "T1 through T5. Lit nodes stay on this device.",
};

export default function TiersPage() {
  return <TiersScreen />;
}
