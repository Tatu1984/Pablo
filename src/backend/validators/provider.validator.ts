import { z } from "zod";

export const providerType = z.enum([
  "openrouter",
  "openai",
  "anthropic",
  "google",
  "bedrock",
  "openai_compatible",
  "ollama",
]);

export const createProviderSchema = z
  .object({
    type: providerType,
    name: z.string().trim().min(1).max(120),
    base_url: z.string().trim().url().optional().or(z.literal("")).transform(emptyToNull),
    api_key: z.string().trim().optional().transform(emptyToNull),
    models: z.array(z.string().trim().min(1)).default([]),
    // Bedrock extras — optional for other provider types.
    region: z.string().trim().optional().transform(emptyToNull),
    role_arn: z.string().trim().optional().transform(emptyToNull),
  })
  .superRefine((v, ctx) => {
    // Base URL required for the two "endpoint-agnostic" provider types.
    if ((v.type === "openai_compatible" || v.type === "ollama") && !v.base_url) {
      ctx.addIssue({
        code: "custom",
        path: ["base_url"],
        message: "Base URL is required for this provider type.",
      });
    }
    // API key required for managed providers except ollama (optional) and bedrock (uses IAM).
    const needsKey = v.type !== "ollama" && v.type !== "bedrock";
    if (needsKey && !v.api_key) {
      ctx.addIssue({
        code: "custom",
        path: ["api_key"],
        message: "API key is required for this provider type.",
      });
    }
  });

export const updateProviderSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    base_url: z.string().trim().url().optional(),
    api_key: z.string().trim().optional(),
    models: z.array(z.string().trim().min(1)).optional(),
    status: z.enum(["active", "disabled"]).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No changes supplied" });

function emptyToNull(v: string | undefined) {
  return !v || v.length === 0 ? null : v;
}

export type CreateProviderInput = z.infer<typeof createProviderSchema>;
export type UpdateProviderInput = z.infer<typeof updateProviderSchema>;
