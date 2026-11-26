// SPDX-License-Identifier: MIT
import type { Metadata } from "next";
import { RelayBoard } from "../../components/relay-board";

export const metadata: Metadata = {
  title: "Relay",
  description: "Relay board in demo mode. Synthetic fixtures. Nothing is posted.",
};

export default function RelayPage() {
  return <RelayBoard />;
}
