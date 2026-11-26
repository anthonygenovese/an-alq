// SPDX-License-Identifier: MIT
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SensorNote } from "../src/ui/SensorNote.js";

describe("sensor late copy", () => {
  it("names the five newest Nixle alerts, not the whole inbox", () => {
    const html = renderToStaticMarkup(createElement(SensorNote, { late: true }));
    expect(html).toContain("no longer in your latest 5 Nixle alerts");
    const quiet = renderToStaticMarkup(createElement(SensorNote, { late: false }));
    expect(quiet).toBe("");
  });
});
