// SPDX-License-Identifier: MIT
import assert from "node:assert/strict";
import test from "node:test";
import {
  flippedTheme,
  readThemeFromStores,
  themeBootScript,
  themeChoice,
  writeThemeToStores,
} from "../theme.ts";

function memoryStore(initial: string | null = null) {
  let value = initial;
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => {
      value = next;
    },
    read: () => value,
  };
}

test("reads the first store that returns a theme", () => {
  const blocked = {
    getItem: () => {
      throw new Error("localStorage blocked");
    },
  };
  const session = memoryStore("dark");
  assert.equal(readThemeFromStores([blocked, session], null), "dark");
});

test("skips a store that accepts a write but does not read it back", () => {
  const partitioned = {
    getItem: () => null,
    setItem: () => undefined,
  };
  const session = memoryStore(null);
  assert.equal(writeThemeToStores("light", [partitioned, session]), true);
  assert.equal(session.read(), "light");
  assert.equal(readThemeFromStores([partitioned, session], null), "light");
});

test("remembers the choice in memory when every store throws", () => {
  const blocked = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
  };
  assert.equal(writeThemeToStores("light", [blocked]), false);
  assert.equal(readThemeFromStores([blocked, blocked], "light"), "light");
});

test("flips the applied theme rather than a stale snapshot", () => {
  assert.equal(themeChoice("light"), "light");
  assert.equal(themeChoice("nope"), null);
  assert.equal(flippedTheme("light"), "dark");
  assert.equal(flippedTheme("dark"), "light");
});

test("boot script tries sessionStorage and marks Instagram only", () => {
  assert.match(themeBootScript, /read\(localStorage\) \|\| read\(sessionStorage\)/);
  assert.match(themeBootScript, /Instagram/);
  assert.match(themeBootScript, /dataset\.webview = "instagram"/);
});
