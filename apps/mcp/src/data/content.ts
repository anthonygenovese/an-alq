import type { ZodType } from "zod/v3";
import frontierFile from "../../content/frontier-picks.json" with { type: "json" };
import newsFile from "../../content/news-drops.json" with { type: "json" };
import {
  formatIssues,
  frontierFileSchema,
  newsDropFileSchema,
  type FrontierFile,
  type NewsDropFile,
} from "../schemas.js";

function parseFile<T>(name: string, schema: ZodType<T>, data: unknown): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new Error(`${name} failed validation: ${formatIssues(parsed.error)}`);
  }
  return parsed.data;
}

export const newsDrops: NewsDropFile = parseFile(
  "content/news-drops.json",
  newsDropFileSchema,
  newsFile,
);

export const frontierPicks: FrontierFile = parseFile(
  "content/frontier-picks.json",
  frontierFileSchema,
  frontierFile,
);

export function newsDropForSlot(
  slot: NewsDropFile["drops"][number]["slot"],
): NewsDropFile["drops"][number] | undefined {
  return newsDrops.drops.find((drop) => drop.slot === slot);
}

export function frontierMonth(month: string): FrontierFile["months"][number] | undefined {
  return frontierPicks.months.find((entry) => entry.month === month);
}

export function frontierMonths(): string[] {
  return frontierPicks.months.map((entry) => entry.month);
}
