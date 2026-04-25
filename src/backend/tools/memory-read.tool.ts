import { ToolError } from "./types";
import type { Tool } from "./types";
import { readMemory } from "@/backend/repositories/memory.repository";

export const memoryReadTool: Tool = {
  name: "memory.read",
  description:
    "Read a value previously stored with memory.write. Memory is per-agent and persistent across runs.",
  input_schema: {
    type: "object",
    required: ["key"],
    properties: {
      key: { type: "string", maxLength: 200 },
    },
  },
  output_schema: {
    type: "object",
    properties: {
      value: {},
      found: { type: "boolean" },
    },
  },

  async execute(rawInput, ctx) {
    const input = rawInput as { key: string };
    if (typeof input?.key !== "string" || !input.key) {
      throw new ToolError("invalid_input", "`key` is required.");
    }
    const value = await readMemory(ctx.agentId, input.key);
    return { value, found: value !== null };
  },
};
