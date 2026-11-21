export interface GlossaryEntry {
  id: string;
  term: string;
  expansion: string;
  definition: string;
  see_also: readonly string[];
  aliases: readonly string[];
}

const ENTRIES: readonly GlossaryEntry[] = [
  {
    id: "rgpo",
    term: "RGPO",
    expansion: "Range gate pull-off",
    definition:
      "A deceptive electronic-attack concept in open EW literature: a repeater-style return is used to draw a radar's range-tracking gate away from the true target range. This entry defines the term. It does not describe a pull schedule or a waveform.",
    see_also: ["vgpo", "drfm", "deceptive_jamming"],
    aliases: ["range_gate_pull_off", "range_gate_pulloff"],
  },
  {
    id: "vgpo",
    term: "VGPO",
    expansion: "Velocity gate pull-off",
    definition:
      "The velocity-domain counterpart of RGPO, as described in open literature: a deception concept that walks a radar's velocity gate off the true Doppler return. Definition only.",
    see_also: ["rgpo", "drfm", "deceptive_jamming"],
    aliases: ["velocity_gate_pull_off", "velocity_gate_pulloff"],
  },
  {
    id: "drfm",
    term: "DRFM",
    expansion: "Digital radio frequency memory",
    definition:
      "A digital receiver-memory architecture that stores a short slice of a received radio signal so a coherent copy can be retransmitted. Textbooks treat it as the usual hardware concept behind coherent deception techniques such as RGPO. This entry does not describe how to build or program one.",
    see_also: ["rgpo", "vgpo"],
    aliases: ["digital_radio_frequency_memory", "digital_rf_memory"],
  },
  {
    id: "esm",
    term: "ESM",
    expansion: "Electronic support measures",
    definition:
      "Passive collection and classification of electromagnetic emissions to build situational awareness. ESM listens. It does not transmit.",
    see_also: ["elint", "sigint"],
    aliases: ["electronic_support_measures", "electronic_support"],
  },
  {
    id: "elint",
    term: "ELINT",
    expansion: "Electronic intelligence",
    definition:
      "Intelligence derived from non-communications electromagnetic emissions, especially radar. A branch of SIGINT, alongside COMINT. The public AN-ALQ page names an active ELINT mode. This server does not collect emissions.",
    see_also: ["esm", "sigint", "comint"],
    aliases: ["electronic_intelligence"],
  },
  {
    id: "tdoa",
    term: "TDOA",
    expansion: "Time difference of arrival",
    definition:
      "A passive geolocation concept: compare when the same signal arrives at separated receivers. The differences constrain where the emitter might be. This entry names the concept. It does not compute a fix.",
    see_also: ["aoa", "elint"],
    aliases: ["time_difference_of_arrival"],
  },
  {
    id: "aoa",
    term: "AOA",
    expansion: "Angle of arrival",
    definition:
      "A direction-finding concept that estimates the bearing of an incoming signal, often with an antenna array. Named here as education. No bearing is calculated.",
    see_also: ["tdoa", "elint"],
    aliases: ["angle_of_arrival"],
  },
  {
    id: "fhss",
    term: "FHSS",
    expansion: "Frequency-hopping spread spectrum",
    definition:
      "A spread-spectrum modulation that switches the carrier among a set of frequencies over time. Used by civilian and military radios to resist interference. The AN-ALQ communications page says FHSS is handled natively. This server does not hop or follow a hop.",
    see_also: ["dsss"],
    aliases: ["frequency_hopping", "frequency_hopping_spread_spectrum"],
  },
  {
    id: "dsss",
    term: "DSSS",
    expansion: "Direct-sequence spread spectrum",
    definition:
      "A spread-spectrum modulation that multiplies the data by a faster code so the energy occupies a wider bandwidth. GPS and many commercial links use forms of it. Definition only.",
    see_also: ["fhss", "gnss_spoofing"],
    aliases: ["direct_sequence", "direct_sequence_spread_spectrum"],
  },
  {
    id: "spot_jamming",
    term: "Spot jamming",
    expansion: "Spot jamming",
    definition:
      "A noise-jamming concept concentrated on a narrow frequency occupied by one emitter, as opposed to covering a whole band. Named on the public AN-ALQ radar page. No jammer is implemented here.",
    see_also: ["barrage_jamming", "swept_jamming", "noise_jamming"],
    aliases: ["spot_jam"],
  },
  {
    id: "barrage_jamming",
    term: "Barrage jamming",
    expansion: "Barrage jamming",
    definition:
      "A noise-jamming concept that covers a wide band at once, trading power density for breadth. Named on the public radar page. Definition only.",
    see_also: ["spot_jamming", "swept_jamming", "noise_jamming"],
    aliases: ["barrage_jam"],
  },
  {
    id: "swept_jamming",
    term: "Swept jamming",
    expansion: "Swept jamming",
    definition:
      "A noise-jamming concept that moves a relatively narrow noise band across a frequency range over time. Named on the public radar page. Definition only.",
    see_also: ["spot_jamming", "barrage_jamming", "noise_jamming"],
    aliases: ["sweep_jamming", "swept_jam"],
  },
  {
    id: "angle_deception",
    term: "Angle deception",
    expansion: "Angle deception",
    definition:
      "A family of radar-deception concepts aimed at the angle-tracking channel rather than range or velocity. The public page lists it among supported techniques. This glossary does not describe geometry or signal conditions.",
    see_also: ["rgpo", "vgpo", "cross_eye", "deceptive_jamming"],
    aliases: ["angle_deception_jamming"],
  },
  {
    id: "gnss_spoofing",
    term: "GNSS spoofing",
    expansion: "GNSS spoofing",
    definition:
      "Causing a GNSS receiver to compute a misleading position or time by presenting counterfeit navigation signals. Public navigation-security writing treats it as an integrity threat, and the AN-ALQ deception page names it. This server does not describe how to produce those signals.",
    see_also: ["dsss", "deceptive_jamming"],
    aliases: ["gps_spoofing", "gnss_spoof", "gps_spoof"],
  },
  {
    id: "false_target",
    term: "False target",
    expansion: "False target generation",
    definition:
      "An electronic-deception concept in which a sensor is presented with extra returns that resemble additional objects. The public AN-ALQ page cites an illustrative maximum of 64 simultaneous false tracks. This server does not generate a track.",
    see_also: ["deceptive_jamming", "rcs"],
    aliases: ["ftg", "false_target_generation", "false_targets"],
  },
  {
    id: "noise_jamming",
    term: "Noise jamming",
    expansion: "Noise jamming",
    definition:
      "Electronic attack that raises the noise floor in a receiver so the true signal is harder to detect. Distinct from deception, which tries to look like a real return. Definition only.",
    see_also: ["spot_jamming", "barrage_jamming", "deceptive_jamming"],
    aliases: ["noise_jam"],
  },
  {
    id: "deceptive_jamming",
    term: "Deceptive jamming",
    expansion: "Deceptive jamming",
    definition:
      "Electronic attack that imitates a plausible signal instead of only adding noise. RGPO and false targets are the examples usually named in open literature. Definition only.",
    see_also: ["rgpo", "vgpo", "false_target", "noise_jamming"],
    aliases: ["deception_jamming", "deceptive_ea"],
  },
  {
    id: "rcs",
    term: "RCS",
    expansion: "Radar cross section",
    definition:
      "A measure of how large an object appears to a radar, expressed as an equivalent area. The public deception page mentions RCS profiles on illustrative false tracks. This glossary defines the measure and does not assign one.",
    see_also: ["false_target"],
    aliases: ["radar_cross_section"],
  },
  {
    id: "electronic_protection",
    term: "Electronic protection",
    expansion: "Electronic protection",
    definition:
      "Measures a radar or radio takes to resist jamming and deception. Also called electronic counter-countermeasures (ECCM). The defensive counterpart of electronic attack. Definition only.",
    see_also: ["noise_jamming", "deceptive_jamming"],
    aliases: ["ep", "eccm", "electronic_counter_countermeasures"],
  },
  {
    id: "sigint",
    term: "SIGINT",
    expansion: "Signals intelligence",
    definition:
      "Intelligence drawn from the electromagnetic spectrum. The usual split is communications (COMINT) and non-communications emissions (ELINT).",
    see_also: ["elint", "comint", "esm"],
    aliases: ["signals_intelligence"],
  },
  {
    id: "comint",
    term: "COMINT",
    expansion: "Communications intelligence",
    definition:
      "Intelligence derived from collecting communications signals, as distinct from radar ELINT. Definition only. This server does not collect communications.",
    see_also: ["sigint", "elint"],
    aliases: ["communications_intelligence"],
  },
  {
    id: "cross_eye",
    term: "Cross-eye",
    expansion: "Cross-eye jamming",
    definition:
      "An angle-deception concept named in open literature and on the AN-ALQ capabilities page. This glossary identifies the term only.",
    see_also: ["angle_deception", "deceptive_jamming"],
    aliases: ["cross_eye_jamming", "crosseye"],
  },
  {
    id: "terrain_bounce",
    term: "Terrain bounce",
    expansion: "Terrain bounce jamming",
    definition:
      "A deception concept named on the public AN-ALQ capabilities page. This glossary identifies the term only.",
    see_also: ["deceptive_jamming", "false_target"],
    aliases: ["terrain_bounce_jamming"],
  },
  {
    id: "pri",
    term: "PRI",
    expansion: "Pulse repetition interval",
    definition:
      "The time from the start of one radar pulse to the start of the next, usually quoted in microseconds in textbooks. Definition only. This entry does not describe a pulse to transmit.",
    see_also: ["prf", "elint"],
    aliases: ["pulse_repetition_interval"],
  },
  {
    id: "prf",
    term: "PRF",
    expansion: "Pulse repetition frequency",
    definition:
      "How often a pulsed radar emits, in pulses per second. It is the reciprocal of the pulse repetition interval. Definition only.",
    see_also: ["pri", "elint"],
    aliases: ["pulse_repetition_frequency"],
  },
  {
    id: "chirp",
    term: "Chirp",
    expansion: "Linear FM pulse",
    definition:
      "A pulse whose frequency sweeps during the pulse, drawn as a diagonal on a spectrogram. Textbooks also call this linear frequency modulation. Definition only. No sweep schedule is given here.",
    see_also: ["prf", "fmcw"],
    aliases: ["linear_fm", "linear_chirp", "lfm"],
  },
  {
    id: "fmcw",
    term: "FMCW",
    expansion: "Frequency-modulated continuous wave",
    definition:
      "A continuous-wave radar concept that sweeps frequency over time, often drawn as a repeating sawtooth on a waterfall. Definition only.",
    see_also: ["chirp"],
    aliases: ["frequency_modulated_continuous_wave", "fm_cw"],
  },
  {
    id: "ofdm",
    term: "OFDM",
    expansion: "Orthogonal frequency-division multiplexing",
    definition:
      "A modulation that packs many narrow subcarriers into one wider block. LTE uses a form of it. On a waterfall the cartoon is a solid wide band rather than a thin line. Definition only.",
    see_also: ["dsss", "comint"],
    aliases: ["orthogonal_frequency_division_multiplexing"],
  },
  {
    id: "snr",
    term: "SNR",
    expansion: "Signal-to-noise ratio",
    definition:
      "How far a signal stands above the noise floor, in decibels. A training waterfall uses an illustrative SNR to set difficulty. This entry does not describe a measurement receiver.",
    see_also: ["esm"],
    aliases: ["signal_to_noise", "signal_to_noise_ratio"],
  },
];

export const GLOSSARY: Readonly<Record<string, GlossaryEntry>> = Object.fromEntries(
  ENTRIES.map((entry) => [entry.id, entry]),
);

export const GLOSSARY_IDS: readonly string[] = ENTRIES.map((entry) => entry.id);

const aliasPairs = ENTRIES.flatMap((entry) =>
  [entry.id, ...entry.aliases].map((alias) => [alias, entry.id] as const),
);
const seenAliases = new Set<string>();
for (const [alias] of aliasPairs) {
  if (seenAliases.has(alias)) {
    throw new Error(`duplicate glossary id: ${alias}`);
  }
  seenAliases.add(alias);
}
const ALIAS_INDEX: Readonly<Record<string, string>> = Object.fromEntries(aliasPairs);

export function normalizeTermId(input: string): string | undefined {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (!/^[a-z0-9_]{1,64}$/.test(normalized)) return undefined;
  return normalized;
}

export function resolveGlossaryEntry(input: string): GlossaryEntry | undefined {
  const normalized = normalizeTermId(input);
  if (!normalized) return undefined;
  const id = ALIAS_INDEX[normalized];
  if (!id) return undefined;
  return GLOSSARY[id];
}
