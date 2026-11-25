// SPDX-License-Identifier: MIT
import type { Category } from "./types.js";

const RULES: ReadonlyArray<{ category: Category; pattern: RegExp }> = [
  {
    category: "missing_person",
    pattern:
      /\b(amber alert|silver alert|missing person|missing child|missing juvenile|missing adult|endangered missing|have you seen)\b/,
  },
  {
    category: "fire_ems",
    pattern:
      /\b(structure fire|working fire|house fire|hazmat|medical emergency|smoke showing|fire department|flames|rescue|ems|fire)\b/,
  },
  {
    category: "weather",
    pattern:
      /\b(tornado|hurricane|flash flood|flood warning|flooding|flood|thunderstorm|winter storm|blizzard|high wind|heat advisory|freeze warning|coastal flood|weather advisory|snow emergency|snow)\b/,
  },
  {
    category: "traffic",
    pattern:
      /\b(traffic|road clos\w*|lane clos\w*|disabled vehicle|crash|accident|delays|overturned|roadway|bridge clos\w*)\b/,
  },
  {
    category: "public_works",
    pattern:
      /\b(water main|boil water|power outage|outage|utility work|road work|construction|detour|sewage|gas leak)\b/,
  },
  {
    category: "crime",
    pattern:
      /\b(police activity|shots fired|robbery|burglary|suspect|assault|lockdown|shelter in place|investigation|shooting|wanted|crime scene)\b/,
  },
];

const PRIORITY: readonly Category[] = [
  "missing_person",
  "fire_ems",
  "weather",
  "traffic",
  "public_works",
  "crime",
  "other",
];

export function classify(normalized: string): Category {
  for (const rule of RULES) {
    if (rule.pattern.test(normalized)) return rule.category;
  }
  return "other";
}

export function preferCategory(left: Category, right: Category): Category {
  const leftRank = PRIORITY.indexOf(left);
  const rightRank = PRIORITY.indexOf(right);
  return leftRank <= rightRank ? left : right;
}
