// SPDX-License-Identifier: MIT
import { readFileSync } from "node:fs";
import { loadScenario, type LoadedScenario } from "../engine/scenario.js";

/** Read a scenario file and rebuild its round from the seed. Node only. */
export function loadScenarioFile(filePath: string): LoadedScenario {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Scenario file is not JSON", { cause: error });
    }
    throw error;
  }
  return loadScenario(value);
}
