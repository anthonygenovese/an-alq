import { INTERSECTIONS, type AgencyRecord } from "./gazetteer.js";
import type { GeoPoint, GeocodeQuery, Geocoder } from "./types.js";

const SUFFIX =
  "street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|highway|hwy|parkway|pkwy|way|place|pl";
const STREET = new RegExp(
  String.raw`\b((?:route|rt|us)\s*\d+|[a-z0-9]+(?:\s+[a-z0-9]+){0,2}\s+(?:${SUFFIX}))\b`,
  "g",
);

export function coarse(value: number): number {
  return Math.round(value * 100) / 100;
}

export function distanceMeters(
  left: { lat: number; lon: number },
  right: { lat: number; lon: number },
): number {
  const radius = 6_371_000;
  const phi1 = (left.lat * Math.PI) / 180;
  const phi2 = (right.lat * Math.PI) / 180;
  const dPhi = ((right.lat - left.lat) * Math.PI) / 180;
  const dLambda = ((right.lon - left.lon) * Math.PI) / 180;
  const h = Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function normalizeStreet(raw: string): string {
  const folded = raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const route = folded.match(/^(?:route|rt|us)\s*(\d+)$/);
  if (route?.[1]) return `route ${route[1]}`;
  return folded;
}

export function parseIntersection(normalized: string): { left: string; right: string } | null {
  const found: string[] = [];
  for (const match of normalized.matchAll(STREET)) {
    const street = match[1];
    if (!street) continue;
    const name = normalizeStreet(street);
    if (!found.includes(name)) found.push(name);
    if (found.length === 2) break;
  }
  const left = found[0];
  const right = found[1];
  if (!left || !right) return null;
  return { left, right };
}

function samePair(
  left: readonly [string, string],
  right: { left: string; right: string },
): boolean {
  const a = normalizeStreet(left[0]);
  const b = normalizeStreet(left[1]);
  return (a === right.left && b === right.right) || (a === right.right && b === right.left);
}

export function point(
  lat: number,
  lon: number,
  precision: GeoPoint["precision"],
  label: string,
): GeoPoint {
  return { lat: coarse(lat), lon: coarse(lon), precision, label };
}

export class OfflineStubGeocoder implements Geocoder {
  readonly id = "offline-stub";

  geocode(query: GeocodeQuery): GeoPoint | null {
    if (query.intersection) {
      const hit = INTERSECTIONS.find((entry) => {
        if (query.jurisdiction && entry.jurisdiction !== query.jurisdiction) return false;
        return samePair(entry.streets, query.intersection as { left: string; right: string });
      });
      if (hit) return point(hit.lat, hit.lon, "intersection", hit.label);
    }
    return null;
  }
}

export function locateAgency(
  agency: AgencyRecord | null,
  intersection: { left: string; right: string } | null,
  geocoder: Geocoder,
): GeoPoint | null {
  const fromStub = geocoder.geocode({
    agencyName: agency?.name ?? null,
    jurisdiction: agency?.jurisdiction ?? null,
    intersection,
  });
  if (fromStub) return fromStub;
  if (!agency) return null;
  return point(agency.lat, agency.lon, "centroid", agency.jurisdiction);
}
