// Tool abstraction (§3.3). Every tool declares a name, an input JSON Schema,
// and an output JSON Schema; execution happens inside an isolated context that
// receives the org/agent/run identifiers and a per-run scratchpad.

export type JsonSchema = Record<string, unknown>;

export interface ToolContext {
  orgId: string;
  agentId: string;
  runId: string;
  ephemeral: Map<string, unknown>;
}

export interface Tool {
  name: string;
  description: string;
  input_schema: JsonSchema;
  output_schema: JsonSchema;
  execute(input: unknown, ctx: ToolContext): Promise<unknown>;
}

export class ToolError extends Error {
  constructor(
    public code:
      | "invalid_input"
      | "invalid_output"
      | "unsupported"
      | "egress_blocked"
      | "timeout"
      | "upstream"
      | "limit_exceeded",
    message: string,
  ) {
    super(message);
  }
}

// LLM tool function names must match ^[a-zA-Z0-9_-]{1,64}$ — convert
// "http.request" ↔ "http_request" at the gateway boundary.
export function toLlmToolName(name: string): string {
  return name.replace(/\./g, "_");
}
export function fromLlmToolName(name: string): string {
  return name.replace(/_/g, ".");
}
