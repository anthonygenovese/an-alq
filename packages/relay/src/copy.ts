export const X_ONLY_BADGE = "ZIP only, nothing personal stored.";

export const GMAIL_SENSITIVITY = "high" as const;

export const GMAIL_CONSENT = {
  title: "Arm inbox sensor",
  read: "Nixle emails only, read-only.",
  kept: "Nothing personal.",
  server: "The server never learns who you are.",
} as const;

export const GMAIL_RESTRICTED_NOTE =
  "gmail.readonly is a Google restricted scope. Until the OAuth app is verified and a CASA review is done, only test users can arm this sensor.";

export const SENSOR_SWITCH = "Arm inbox sensor";

export const SENSOR_TOO_LATE = "no longer in your latest 5 Nixle alerts";
