import { z } from 'zod';

const RunningStyle = z.enum(['E', 'E/P', 'P', 'S']);

// ---------------------------------------------------------------------------
// API response — POST /api/simulate
// Snake_case on the wire, matching what api/simulate.py returns.
// ---------------------------------------------------------------------------

const HorseResultSchema = z.object({
  id: z.string(),
  name: z.string(),
  post_position: z.number().int().min(1).max(20),
  p_win: z.number().min(0).max(1),
  p_top3: z.number().min(0).max(1),
  p_top4: z.number().min(0).max(1),
  mean_finish: z.number().min(0),
  finish_histogram: z.array(z.number().min(0).max(1)),
});

const ScenarioEchoSchema = z.object({
  track: z.string(),
  pace: z.string(),
  beliefs: z.record(z.string(), z.number()),
  iterations: z.number().int().optional(),
  seed: z.number().int().nullable().optional(),
});

export const SimResponseSchema = z.object({
  results: z.array(HorseResultSchema).min(1),
  scenario: ScenarioEchoSchema,
  iterations: z.number().int().min(1),
  elapsed_ms: z.number().min(0),
  field_size: z.number().int().min(1),
});

export type SimResponseValidated = z.infer<typeof SimResponseSchema>;

/** Validate a /api/simulate response. On failure, logs the offending issue
 *  with full path and the bad value, then re-throws so the caller can
 *  surface a real error to the user (instead of silently empty UI). */
export function validateSimResponse(raw: unknown): SimResponseValidated {
  const result = SimResponseSchema.safeParse(raw);
  if (result.success) return result.data;
  const issues = result.error.issues
    .map((i) => `  • ${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('\n');
  console.error(
    '[schema] /api/simulate response failed validation:\n' + issues,
    '\n[schema] received:',
    raw,
  );
  throw new Error(
    `Invalid /api/simulate response — ${result.error.issues[0]?.path.join('.') || 'root'}: ${result.error.issues[0]?.message}`,
  );
}

const Silk = z.object({
  pattern: z.enum(['solid', 'diamonds', 'stripes', 'quartered', 'chevrons', 'hoops']),
  primary: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  secondary: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

export const HorseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  post_position: z.number().int().min(1).max(20),
  jockey: z.string().nullable().optional(),
  trainer: z.string().nullable().optional(),
  morning_line: z
    .string()
    .regex(/^\d+-\d+$/, 'morning_line must look like "5-2" or null')
    .nullable()
    .optional(),
  beyer_last_3: z
    .array(z.number().int().min(0).max(140))
    .min(1, 'each horse needs at least one Beyer figure'),
  running_style: RunningStyle,
  distance_aptitude: z.number().min(0).max(1),
  class_rating: z.number().min(0).max(10),
  surface_aptitude_dirt: z.number().min(0).max(1),
  surface_aptitude_wet: z.number().min(0).max(1).nullable().optional(),
  pace_figure_avg: z.number().min(0),
  silk: Silk.nullable().optional(),
});

export const FieldSchema = z.object({
  meta: z.object({
    race: z.string(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    distance: z.string().optional(),
    surface: z.string().optional(),
    note: z.string().optional(),
    updated: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    projected_morning_lines: z.boolean().optional(),
    sources: z.array(z.string()).optional(),
  }),
  horses: z
    .array(HorseSchema)
    .min(1)
    .superRefine((horses, ctx) => {
      const ids = new Set<string>();
      const posts = new Set<number>();
      for (const h of horses) {
        if (ids.has(h.id))
          ctx.addIssue({
            code: 'custom',
            message: `duplicate horse id: ${h.id}`,
            path: [],
          });
        ids.add(h.id);
        if (posts.has(h.post_position))
          ctx.addIssue({
            code: 'custom',
            message: `duplicate post position: ${h.post_position}`,
            path: [],
          });
        posts.add(h.post_position);
      }
    }),
});

export type ValidatedField = z.infer<typeof FieldSchema>;

export function validateField(raw: unknown): ValidatedField {
  return FieldSchema.parse(raw);
}
