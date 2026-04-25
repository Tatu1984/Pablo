import { httpRequestTool } from "./http-request.tool";
import { webhookTriggerTool } from "./webhook-trigger.tool";
import { jsonTransformTool } from "./json-transform.tool";
import { memoryReadTool } from "./memory-read.tool";
import { memoryWriteTool } from "./memory-write.tool";
import type { Tool } from "./types";

const TOOLS: Tool[] = [
  httpRequestTool,
  webhookTriggerTool,
  jsonTransformTool,
  memoryReadTool,
  memoryWriteTool,
];

const BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

export function getTool(name: string): Tool | undefined {
  return BY_NAME.get(name);
}

export function listTools(): Tool[] {
  return TOOLS.slice();
}

// Filter the registry to the agent's allow-listed names; preserves order.
export function toolsForAgent(allowList: string[]): Tool[] {
  return allowList.map((n) => BY_NAME.get(n)).filter((t): t is Tool => Boolean(t));
}
