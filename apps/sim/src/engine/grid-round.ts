import { z } from "zod/v3";
import { mulberry32 } from "./prng.js";

/** Fictional grid. Cell indexes only. Not a location. */
export const GRID_SIZE = 4;
export const GRID_ROUND_SCHEMA = "an-alq.grid-round.v1" as const;
export const GRID_NODE_ID = "converging-fix" as const;

const cellSchema = z
  .object({
    col: z
      .number()
      .int()
      .min(0)
      .max(GRID_SIZE - 1),
    row: z
      .number()
      .int()
      .min(0)
      .max(GRID_SIZE - 1),
  })
  .strict();

const lineSchema = z
  .object({
    id: z.enum(["lamp-a", "lamp-b"]),
    cells: z.array(cellSchema).length(GRID_SIZE),
  })
  .strict();

export const gridRoundSchema = z
  .object({
    schema: z.literal(GRID_ROUND_SCHEMA),
    tier: z.literal("T2"),
    nodeId: z.literal(GRID_NODE_ID),
    seed: z.number().int().nonnegative(),
    figures_are: z.literal("illustrative"),
    fictional: z.literal(true),
    operational: z.literal(false),
    gridSize: z.literal(GRID_SIZE),
    prompt: z.string().min(12).max(240),
    lines: z.tuple([lineSchema, lineSchema]),
    answer: cellSchema,
  })
  .strict();

export type GridCell = z.infer<typeof cellSchema>;
export type GridRound = z.infer<typeof gridRoundSchema>;

const PROMPT =
  "Two synthetic lines share one cell on this fictional grid. Pick that cell. Illustrative. Not a location.";

/** Seeded column line and row line. Their shared cell is the answer. No measurement is used. */
export function generateGridRound(seed: number): GridRound {
  const rng = mulberry32(seed >>> 0);
  const col = Math.floor(rng() * GRID_SIZE);
  const row = Math.floor(rng() * GRID_SIZE);
  const columnLine = Array.from({ length: GRID_SIZE }, (_, index) => ({ col, row: index }));
  const rowLine = Array.from({ length: GRID_SIZE }, (_, index) => ({ col: index, row }));
  const round: GridRound = {
    schema: GRID_ROUND_SCHEMA,
    tier: "T2",
    nodeId: GRID_NODE_ID,
    seed: seed >>> 0,
    figures_are: "illustrative",
    fictional: true,
    operational: false,
    gridSize: GRID_SIZE,
    prompt: PROMPT,
    lines: [
      { id: "lamp-a", cells: columnLine },
      { id: "lamp-b", cells: rowLine },
    ],
    answer: { col, row },
  };
  const parsed = gridRoundSchema.safeParse(round);
  if (!parsed.success) throw new Error("Grid round failed validation");
  return parsed.data;
}

export function cellOnLine(line: readonly GridCell[], cell: GridCell): boolean {
  return line.some((item) => item.col === cell.col && item.row === cell.row);
}

export function scoreGridPick(
  round: GridRound,
  pick: GridCell | null,
  elapsedMs: number,
): { correct: boolean; elapsedMs: number } {
  const elapsed = Math.max(0, elapsedMs);
  if (!pick) return { correct: false, elapsedMs: elapsed };
  const correct = pick.col === round.answer.col && pick.row === round.answer.row;
  return { correct, elapsedMs: elapsed };
}
