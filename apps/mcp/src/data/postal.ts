// SPDX-License-Identifier: MIT
/** Public USPS first-digit areas. A note for a sample edition, not a location. */
const PREFIX_REGION: Readonly<Record<string, string>> = {
  "0": "USPS prefix 0 (New England, New Jersey, Puerto Rico, and nearby)",
  "1": "USPS prefix 1 (New York, Pennsylvania, and Delaware)",
  "2": "USPS prefix 2 (Mid-Atlantic and the Carolinas)",
  "3": "USPS prefix 3 (Southeast)",
  "4": "USPS prefix 4 (Ohio Valley and Great Lakes)",
  "5": "USPS prefix 5 (Upper Midwest and Northern Plains)",
  "6": "USPS prefix 6 (Central Plains)",
  "7": "USPS prefix 7 (South Central)",
  "8": "USPS prefix 8 (Mountain West)",
  "9": "USPS prefix 9 (Pacific coast, Alaska, Hawaii, and nearby)",
};

export function postalRegionFromZip(zip: string): string {
  const region = PREFIX_REGION[zip[0] ?? ""];
  if (!region) {
    throw new Error("ZIP must be exactly 5 digits");
  }
  return region;
}
