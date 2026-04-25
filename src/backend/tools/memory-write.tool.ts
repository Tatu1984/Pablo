import { ToolError } from "./types";
import type { Tool } from "./types";
import { writeMemory } from "@/backend/repositories/memory.repository";

const MAX_VALUE_BYTES = 100_000;

export const memoryWriteTool: Tool = {
  name: "memory.write",
  description:
    "Persist a value under a key for this agent. Survives across runs. Use for things you want the agent to remember between conversations.",
  input_schema: {
    type: "object",
    required: ["key", "value"],
    properties: {
      key: { type: "string", maxLength: 200 },
      value: { description: "Any JSON-serialisable value." },
    },
  },
  output_schema: {
    type: "object",
    properties: {
      ok: { type: "boolean" },
      updated_at: { type: "string" },
    },
  },

  async execute(rawInput, ctx) {
    const input = rawInput as { key: string; value: unknown };
    if (typeof input?.key !== "string" || !input.key) {
      throw new ToolError("invalid_input", "`key` is required.");
    }
    if (input.value === undefined) {
      throw new ToolError("invalid_input", "`value` is required.");
    }
    const serialised = JSON.stringify(input.value);
    if (serialised.length > MAX_VALUE_BYTES) {
      throw new ToolError(
        "limit_exceeded",
        `value exceeds ${MAX_VALUE_BYTES} byte limit (${serialised.length}).`,
      );
    }
    const entry = await writeMemory(ctx.agentId, input.key, input.value);
    return { ok: true, updated_at: entry.updated_at };
  },
};
