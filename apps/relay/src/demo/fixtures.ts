export interface FixturePost {
  /** Milliseconds from the demo epoch. */
  atMs: number;
  text: string;
  /** Fake contributor token. Hashed and discarded. Never rendered. */
  token: string;
  urls?: readonly string[];
}

const TRAFFIC =
  "South Brunswick PD: Traffic advisory. Route 1 southbound closed at Finnegans Lane due to a disabled vehicle. Expect delays.";
const TRAFFIC_URL = "https://local.nixle.com/alert/1000001";
const WEATHER =
  "South Brunswick OEM: Flash flood warning for the township until evening. Avoid low roads.";
const WEATHER_URL = "https://nixle.us/SYNTH1002";

/**
 * Synthetic posts. Handles are fake on purpose and must never reach the UI.
 * Times are offsets from the demo epoch so the clock can run fast.
 */
export const FIXTURES: readonly FixturePost[] = [
  {
    atMs: 0,
    token: "fixture-north",
    text: `${TRAFFIC} ${TRAFFIC_URL} @fixture_north #traffic`,
    urls: [TRAFFIC_URL],
  },
  {
    atMs: 2_000,
    token: "fixture-west",
    text: "@fixture_west coffee is great today, not an alert",
  },
  {
    atMs: 4_000,
    token: "fixture-north",
    text: `${TRAFFIC} ${TRAFFIC_URL} @fixture_north`,
    urls: [TRAFFIC_URL],
  },
  {
    atMs: 6_000,
    token: "fixture-north",
    text: `${WEATHER} ${WEATHER_URL}`,
    urls: [WEATHER_URL],
  },
  {
    atMs: 8_000,
    token: "fixture-south",
    text: "South Brunswick PD: Road closed due to flooding. Avoid the area.",
  },
  {
    atMs: 8_000,
    token: "fixture-east",
    text: "NYPD: Road closed due to flooding. Avoid the area.",
  },
  {
    atMs: 12_000,
    token: "fixture-east",
    text: `South Brunswick Police say Route 1 southbound is closed at Finnegans Lane because of a disabled vehicle. Expect delays. ${TRAFFIC_URL}`,
    urls: [TRAFFIC_URL],
  },
  {
    atMs: 14_000,
    token: "fixture-north",
    text: `Traffic advisory from South Brunswick PD. Route 1 southbound closed at Finnegans Lane, disabled vehicle, delays expected. ${TRAFFIC_URL}`,
    urls: [TRAFFIC_URL],
  },
  {
    atMs: 16_000,
    token: "fixture-east",
    text: `Flash flood warning from South Brunswick OEM. Avoid low roads. ${WEATHER_URL}`,
    urls: [WEATHER_URL],
  },
  {
    atMs: 20_000,
    token: "fixture-west",
    text: "NYPD: Missing person exercise advisory. Synthetic fixture, not a real person, last marked near 42nd Street and 7th Avenue. https://local.nixle.com/alert/1000008",
    urls: ["https://local.nixle.com/alert/1000008"],
  },
  {
    atMs: 22_000,
    token: "fixture-north",
    text: "South Brunswick Public Works: Water main break near Route 1 and Finnegans Lane. Synthetic fixture.",
  },
  {
    atMs: 28_000,
    token: "fixture-south",
    text: "FDNY: Structure fire on 42nd Street and 7th Avenue. Avoid the block. Synthetic fixture. https://local.nixle.com/alert/1000009",
    urls: ["https://local.nixle.com/alert/1000009"],
  },
  {
    atMs: 36_000,
    token: "fixture-north",
    text: "Edison PD: Traffic advisory. Route 1 delays near Oak Tree Road. Synthetic fixture. https://local.nixle.com/alert/1000020",
    urls: ["https://local.nixle.com/alert/1000020"],
  },
  {
    atMs: 48_000,
    token: "fixture-east",
    text: "Newark PD: Police activity near Broad Street and Market Street. Avoid the area. Synthetic fixture. https://local.nixle.com/alert/1000011",
    urls: ["https://local.nixle.com/alert/1000011"],
  },
  {
    atMs: 45 * 60_000,
    token: "fixture-north",
    text: `${TRAFFIC} ${TRAFFIC_URL}`,
    urls: [TRAFFIC_URL],
  },
];
