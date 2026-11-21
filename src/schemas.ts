import { z } from "zod/v3";

/**
 * Zod 3 objects, from the `zod/v3` entry of Zod 4.6+.
 * `@modelcontextprotocol/sdk` validates these with `.safeParse`, so `.strict()`
 * becomes `additionalProperties: false` and unknown keys are rejected.
 * Zod 4 classic objects take a different parse path inside the SDK.
 */

export const emptyArgsSchema = z.object({}).strict();

export const newsDropArgsSchema = z
  .object({
    slot: z.enum(["morning", "midday", "afternoon"], {
      errorMap: () => ({ message: "slot must be morning, midday, or afternoon" }),
    }),
    zip: z
      .string({ invalid_type_error: "ZIP must be a string of exactly 5 digits" })
      .regex(/^\d{5}$/, "ZIP must be exactly 5 digits")
      .optional(),
  })
  .strict();

export const frontierArgsSchema = z
  .object({
    month: z
      .string({ invalid_type_error: "month must be a YYYY-MM string" })
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "month must be YYYY-MM"),
  })
  .strict();

export const explainTermArgsSchema = z
  .object({
    term: z
      .string({ invalid_type_error: "term must be a string" })
      .min(1, "term is required")
      .max(64, "term is too long"),
  })
  .strict();

export const zipCheckInArgsSchema = z
  .object({
    zip: z
      .string({ invalid_type_error: "ZIP must be a string of exactly 5 digits" })
      .regex(/^\d{5}$/, "ZIP must be exactly 5 digits"),
  })
  .strict();

export type NewsDropArgs = z.infer<typeof newsDropArgsSchema>;
export type FrontierArgs = z.infer<typeof frontierArgsSchema>;
export type ExplainTermArgs = z.infer<typeof explainTermArgsSchema>;

export function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join("; ");
}

const labelSchema = z.enum(["example", "editorial"]);

function sampleLabelIssue(sample: boolean, label: "example" | "editorial"): boolean {
  return sample ? label !== "example" : label !== "editorial";
}

const newsItemSchema = z
  .object({
    title: z.string().min(1).max(200),
    dek: z.string().min(1).max(600),
    tag: z.string().min(1).max(40),
  })
  .strict();

const newsDropSchema = z
  .object({
    id: z.string().min(1).max(80),
    slot: z.enum(["morning", "midday", "afternoon"]),
    edition: z.literal("national"),
    headline: z.string().min(1).max(200),
    summary: z.string().min(1).max(800),
    items: z.array(newsItemSchema).min(1).max(8),
    sample: z.boolean(),
    label: labelSchema,
  })
  .strict();

export const newsDropFileSchema = z
  .object({
    format: z.literal("an-alq.news-drop.v1"),
    updated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "updated must be YYYY-MM-DD"),
    sample: z.boolean(),
    label: labelSchema,
    disclaimer: z.string().min(1).max(800),
    drops: z.array(newsDropSchema).length(3),
  })
  .strict()
  .superRefine((file, ctx) => {
    if (sampleLabelIssue(file.sample, file.label)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "file sample/label mismatch",
      });
    }
    const seen = new Set<string>();
    for (const drop of file.drops) {
      if (sampleLabelIssue(drop.sample, drop.label)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "drop sample/label mismatch",
          path: ["drops", drop.slot],
        });
      }
      if (seen.has(drop.slot)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "duplicate slot",
          path: ["drops", drop.slot],
        });
      }
      seen.add(drop.slot);
    }
    for (const slot of ["morning", "midday", "afternoon"] as const) {
      if (!seen.has(slot)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `missing ${slot} drop`,
        });
      }
    }
  });

const frontierPickSchema = z
  .object({
    id: z.string().min(1).max(80),
    title: z.string().min(1).max(200),
    why: z.string().min(1).max(800),
    href: z
      .string()
      .regex(/^https:\/\/[^\s]+$/, "href must be an https URL")
      .optional(),
    sample: z.boolean(),
    label: labelSchema,
  })
  .strict();

const frontierMonthSchema = z
  .object({
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "month must be YYYY-MM"),
    sample: z.boolean(),
    label: labelSchema,
    intro: z.string().min(1).max(800),
    picks: z.array(frontierPickSchema).min(1).max(12),
  })
  .strict();

export const frontierFileSchema = z
  .object({
    format: z.literal("an-alq.frontier-picks.v1"),
    updated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "updated must be YYYY-MM-DD"),
    sample: z.boolean(),
    label: labelSchema,
    disclaimer: z.string().min(1).max(800),
    months: z.array(frontierMonthSchema).min(1).max(36),
  })
  .strict()
  .superRefine((file, ctx) => {
    if (sampleLabelIssue(file.sample, file.label)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "file sample/label mismatch",
      });
    }
    const seen = new Set<string>();
    for (const month of file.months) {
      if (sampleLabelIssue(month.sample, month.label)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "month sample/label mismatch",
          path: ["months", month.month],
        });
      }
      if (seen.has(month.month)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "duplicate month",
          path: ["months", month.month],
        });
      }
      seen.add(month.month);
      for (const pick of month.picks) {
        if (sampleLabelIssue(pick.sample, pick.label)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "pick sample/label mismatch",
            path: ["months", month.month, pick.id],
          });
        }
      }
    }
  });

export type NewsDropFile = z.infer<typeof newsDropFileSchema>;
export type FrontierFile = z.infer<typeof frontierFileSchema>;

export const TOOL_INPUT_SCHEMAS = {
  get_capabilities: emptyArgsSchema,
  get_news_drop: newsDropArgsSchema,
  get_frontier_picks: frontierArgsSchema,
  explain_ew_term: explainTermArgsSchema,
} as const;
