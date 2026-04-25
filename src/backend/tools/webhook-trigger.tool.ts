import { ToolError } from "./types";
import type { Tool } from "./types";

// Real signed-delivery + retries land in Phase 8. For now this tool exists
// so agent prompts can declare it and the LLM gets a coherent shape; calls
// fail clearly until the webhook system is wired up.
export const webhookTriggerTool: Tool = {
  name: "webhook.trigger",
  description:
    "Send a signed event to one of your registered webhooks. Returns the delivery status.",
  input_schema: {
    type: "object",
    required: ["webhook_id", "event"],
    properties: {
      webhook_id: { type: "string" },
      event: { type: "string" },
      payload: {},
    },
  },
  output_schema: {
    type: "object",
    properties: {
      delivered: { type: "boolean" },
      status: { type: "integer" },
      delivery_id: { type: "string" },
    },
  },

  async execute() {
    throw new ToolError(
      "unsupported",
      "webhook.trigger is not wired up yet — it lands with the webhook system.",
    );
  },
};
