export interface AgencyRecord {
  id: string;
  name: string;
  jurisdiction: string;
  aliases: readonly string[];
  lat: number;
  lon: number;
}

export interface IntersectionRecord {
  jurisdiction: string;
  streets: readonly [string, string];
  lat: number;
  lon: number;
  label: string;
}

/** Coarse public centroids. Two decimal degrees, about a kilometer. */
export const AGENCIES: readonly AgencyRecord[] = [
  {
    id: "sbpd",
    name: "South Brunswick PD",
    jurisdiction: "South Brunswick, NJ",
    aliases: [
      "south brunswick police department",
      "south brunswick police",
      "south brunswick pd",
      "south brunswick public works",
      "south brunswick oem",
      "south brunswick township",
    ],
    lat: 40.39,
    lon: -74.54,
  },
  {
    id: "nbpd",
    name: "North Brunswick PD",
    jurisdiction: "North Brunswick, NJ",
    aliases: ["north brunswick police", "north brunswick pd"],
    lat: 40.45,
    lon: -74.48,
  },
  {
    id: "new-brunswick",
    name: "New Brunswick PD",
    jurisdiction: "New Brunswick, NJ",
    aliases: ["new brunswick police", "new brunswick pd"],
    lat: 40.49,
    lon: -74.45,
  },
  {
    id: "edison",
    name: "Edison PD",
    jurisdiction: "Edison, NJ",
    aliases: ["edison police", "edison pd"],
    lat: 40.52,
    lon: -74.41,
  },
  {
    id: "princeton",
    name: "Princeton PD",
    jurisdiction: "Princeton, NJ",
    aliases: ["princeton police", "princeton pd"],
    lat: 40.35,
    lon: -74.66,
  },
  {
    id: "newark",
    name: "Newark PD",
    jurisdiction: "Newark, NJ",
    aliases: ["newark police department", "newark police", "newark pd"],
    lat: 40.74,
    lon: -74.17,
  },
  {
    id: "jersey-city",
    name: "Jersey City PD",
    jurisdiction: "Jersey City, NJ",
    aliases: ["jersey city police", "jersey city pd"],
    lat: 40.73,
    lon: -74.07,
  },
  {
    id: "nypd",
    name: "NYPD",
    jurisdiction: "New York, NY",
    aliases: ["new york police department", "nypd"],
    lat: 40.71,
    lon: -74.01,
  },
  {
    id: "fdny",
    name: "FDNY",
    jurisdiction: "New York, NY",
    aliases: ["fdny", "new york fire department"],
    lat: 40.71,
    lon: -74.01,
  },
];

export const INTERSECTIONS: readonly IntersectionRecord[] = [
  {
    jurisdiction: "South Brunswick, NJ",
    streets: ["route 1", "finnegans lane"],
    lat: 40.39,
    lon: -74.55,
    label: "Route 1 & Finnegans Lane",
  },
  {
    jurisdiction: "New York, NY",
    streets: ["42nd street", "7th avenue"],
    lat: 40.76,
    lon: -73.98,
    label: "42nd Street & 7th Avenue",
  },
  {
    jurisdiction: "Newark, NJ",
    streets: ["broad street", "market street"],
    lat: 40.74,
    lon: -74.17,
    label: "Broad Street & Market Street",
  },
];

export function matchAgency(normalized: string): AgencyRecord | null {
  let best: { agency: AgencyRecord; length: number; index: number } | null = null;
  for (const agency of AGENCIES) {
    for (const alias of agency.aliases) {
      const index = normalized.indexOf(alias);
      if (index < 0) continue;
      if (
        !best ||
        alias.length > best.length ||
        (alias.length === best.length && index < best.index)
      ) {
        best = { agency, length: alias.length, index };
      }
    }
  }
  return best?.agency ?? null;
}
