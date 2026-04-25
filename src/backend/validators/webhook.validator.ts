import { z } from "zod";
import { ALL_EVENTS } from "@/backend/services/webhook.service";

export const createWebhookSchema = z.object({
  url: z.string().trim().url(),
  events: z.array(z.string()).min(1, "At least one event is required"),
});

export const eventEnum = z.enum(ALL_EVENTS as [string, ...string[]]);

export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;
