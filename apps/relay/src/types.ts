export const CATEGORIES = [
  "missing_person",
  "fire_ems",
  "weather",
  "traffic",
  "public_works",
  "crime",
  "other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_CODE: Record<Category, string> = {
  missing_person: "MP",
  fire_ems: "FE",
  weather: "WX",
  traffic: "TR",
  public_works: "PW",
  crime: "PD",
  other: "OT",
};

export const CATEGORY_LABEL: Record<Category, string> = {
  missing_person: "MISSING",
  fire_ems: "FIRE/EMS",
  weather: "WEATHER",
  traffic: "TRAFFIC",
  public_works: "WORKS",
  crime: "POLICE",
  other: "OTHER",
};

export type Precision = "intersection" | "centroid";

export interface GeoPoint {
  lat: number;
  lon: number;
  precision: Precision;
  label: string;
}

export interface GeocodeQuery {
  agencyName: string | null;
  jurisdiction: string | null;
  intersection: { left: string; right: string } | null;
}

export interface Geocoder {
  readonly id: string;
  geocode(query: GeocodeQuery): GeoPoint | null;
}

/** A public post reduced to alert text. Account material is not retained. */
export interface RawPost {
  text: string;
  createdAt: number;
  urls: readonly string[];
  /**
   * Account token used only to build a salted hash. Null when the read
   * payload has no author id. Never logged or serialized.
   */
  accountMaterial: string | null;
  /**
   * Post token used when no account id is available, so a re-fetch does not
   * double-count. Never logged or serialized.
   */
  postMaterial: string;
}

export interface Candidate {
  normalizedText: string;
  summary: string;
  category: Category;
  nixleKey: string | null;
  nixleUrl: string | null;
  agency: string | null;
  jurisdiction: string | null;
  location: GeoPoint | null;
  createdAt: number;
  accountMaterial: string | null;
  postMaterial: string;
}

export interface Pulse {
  periodMs: number;
  opacity: number;
}

export type ReceptionMark = "zk" | "fallback" | "mixed" | "none";

export interface LiveSignal {
  id: string;
  category: Category;
  summary: string;
  agency: string | null;
  jurisdiction: string | null;
  firstSeen: string;
  lastSeen: string;
  nixleUrl: string | null;
  nixleKey: string | null;
  location: GeoPoint | null;
  pulse: Pulse;
  /** Verified receptions. Not a person and not a relay count. */
  receptions: number;
  receptionMark: ReceptionMark;
}

export interface ContributionNode {
  sector: number;
  ring: number;
  opacity: number;
}

export type Sensitivity = "low" | "high";

export interface SourceStatus {
  id: "x" | "gmail";
  sensitivity: Sensitivity;
  enabled: boolean;
  privateData: boolean;
}

export interface LiveStats {
  liveSignals: number;
  relaysInWindow: number;
  windowMs: number;
}

export interface LiveSnapshot {
  mode: "demo" | "live";
  demo: boolean;
  now: string;
  speed: number;
  disclaimer: string;
  signals: LiveSignal[];
  stats: LiveStats;
  contribution: { nodes: ContributionNode[] };
  sources: SourceStatus[];
}

export const DISCLAIMER =
  "Not an emergency service. If you need help, call 911. This view shows aggregated public-agency alert text only. Senders are not shown.";
