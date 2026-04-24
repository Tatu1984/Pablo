import { z } from "zod";

const executionMode = z.enum(["one_shot", "multi_step_loop", "event_triggered"]);

const limitsSchema = z.object({
  max_steps: z.number().int().positive().max(500),
  max_runtime_ms: z.number().int().positive().max(60 * 60 * 1000),
  max_tool_calls: z.number().int().nonnegative().max(1000),
  max_tokens_per_run: z.number().int().positive().max(2_000_000),
});

const jsonSchema = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (!v || !v.trim()) return null;
    try {
      return JSON.parse(v);
    } catch {
      ctx.addIssue({ code: "custom", message: "Must be valid JSON" });
      return z.NEVER;
    }
  });

export const createAgentSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).default(""),
  role: z.string().trim().max(120).default(""),
  execution_mode: executionMode,
  provider_id: z.string().trim().min(1, "Pick a provider"),
  model: z.string().trim().min(1, "Pick a model"),
  tools: z.array(z.string().trim().min(1)).default([]),
  limits: limitsSchema,
  input_schema: jsonSchema,
  output_schema: jsonSchema,
});

export const updateAgentSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(500).optional(),
    role: z.string().trim().max(120).optional(),
    execution_mode: executionMode.optional(),
    provider_id: z.string().trim().min(1).optional(),
    model: z.string().trim().min(1).optional(),
    tools: z.array(z.string().trim().min(1)).optional(),
    limits: limitsSchema.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No changes supplied" });

export const createPromptSchema = z.object({
  system_prompt: z.string().default(""),
  task_prompt: z.string().default(""),
  tool_instructions: z.string().default(""),
  note: z.string().trim().max(200).default(""),
});

export type CreateAgentInput = z.infer<typeof createAgentSchema>;
export type UpdateAgentInput = z.infer<typeof updateAgentSchema>;
export type CreatePromptInput = z.infer<typeof createPromptSchema>;
