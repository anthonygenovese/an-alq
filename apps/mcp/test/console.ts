// SPDX-License-Identifier: MIT
import { vi } from "vitest";

export function captureConsole() {
  const lines: string[] = [];
  const methods = ["log", "info", "warn", "error", "debug"] as const;
  const spies = methods.map((method) =>
    vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
      lines.push(args.map((arg) => String(arg)).join(" "));
    }),
  );
  return {
    lines,
    text: () => lines.join("\n"),
    restore: () => {
      for (const spy of spies) spy.mockRestore();
    },
  };
}
