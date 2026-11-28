// SPDX-License-Identifier: MIT
import type { Metadata } from "next";
import { NotchScreen } from "../../components/notch-screen";

// Not linked from the nav or any other page until QA passes it (Geno's decision). Direct URL only.
export const metadata: Metadata = {
  title: "Spectral notch",
  description: "Spectral notch on a chirp. Synthetic, illustrative data. Static presets.",
};

export default function NotchPage() {
  return <NotchScreen />;
}
