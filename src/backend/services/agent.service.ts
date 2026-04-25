import { newId } from "@/backend/utils/id.util";
import {
  archiveAgent as archiveAgentRow,
  getAgent,
  insertAgent,
  insertPromptVersion,
  listPromptVersions,
  nextPromptVersion,
  updateAgent as updateAgentRow,
  type InsertAgentInput,
} from "@/backend/repositories/agent.repository";
import { getProvider } from "@/backend/repositories/provider.repository";
import type {
  CreateAgentInput,
  CreatePromptInput,
  UpdateAgentInput,
} from "@/backend/validators/agent.validator";
import type { Agent } from "@/shared/types/agent.types";

export class AgentError extends Error {
  constructor(
    public code:
      | "not_found"
      | "provider_not_found"
      | "model_not_allowed"
      | "archive_failed",
    message: string,
  ) {
    super(message);
  }
}

async function assertProviderAndModel(orgId: string, providerId: string, model: string) {
  const p = await getProvider(orgId, providerId);
  if (!p) throw new AgentError("provider_not_found", "Provider not found.");
  if (!p.models.includes(model)) {
    throw new AgentError(
      "model_not_allowed",
      `Model "${model}" is not enabled on provider "${p.name}".`,
    );
  }
  return p;
}

export async function createAgent(orgId: string, input: CreateAgentInput): Promise<Agent> {
  await assertProviderAndModel(orgId, input.provider_id, input.model);

  const agentId = newId("agent");
  const initialVersion = "v1";

  const payload: InsertAgentInput = {
    id: agentId,
    orgId,
    name: input.name,
    role: input.role,
    description: input.description,
    executionMode: input.execution_mode,
    providerId: input.provider_id,
    model: input.model,
    currentPromptVersion: initialVersion,
    tools: input.tools,
    limits: input.limits,
    intro: [`Hello, I'm ${input.name}.`, "Ask me something or kick off a task."],
    skills: [],
    inputSchema: input.input_schema,
    outputSchema: input.output_schema,
  };

  const agent = await insertAgent(payload);
  await insertPromptVersion(
    newId("prm"),
    agentId,
    initialVersion,
    "",
    "",
    "",
    "Created with agent",
  );
  return agent;
}

export async function updateAgent(
  orgId: string,
  id: string,
  input: UpdateAgentInput,
): Promise<Agent> {
  const current = await getAgent(orgId, id);
  if (!current) throw new AgentError("not_found", "Agent not found.");

  const providerId = input.provider_id ?? current.provider_id;
  const model = input.model ?? current.model;
  if (input.provider_id !== undefined || input.model !== undefined) {
    await assertProviderAndModel(orgId, providerId, model);
  }

  const updated = await updateAgentRow(orgId, id, {
    name: input.name,
    role: input.role,
    description: input.description,
    executionMode: input.execution_mode,
    providerId: input.provider_id,
    model: input.model,
    tools: input.tools,
    limits: input.limits,
  });
  if (!updated) throw new AgentError("not_found", "Agent not found.");
  return updated;
}

export async function archiveAgent(orgId: string, id: string): Promise<void> {
  const ok = await archiveAgentRow(orgId, id);
  if (!ok) throw new AgentError("archive_failed", "Agent not found or already archived.");
}

export async function publishPromptVersion(
  orgId: string,
  agentId: string,
  input: CreatePromptInput,
) {
  const agent = await getAgent(orgId, agentId);
  if (!agent) throw new AgentError("not_found", "Agent not found.");

  const version = await nextPromptVersion(agentId);
  const pv = await insertPromptVersion(
    newId("prm"),
    agentId,
    version,
    input.system_prompt,
    input.task_prompt,
    input.tool_instructions,
    input.note || `Published ${version}`,
  );
  await updateAgentRow(orgId, agentId, { currentPromptVersion: version });
  return pv;
}

// Drop a free-tier sample agent into a freshly-provisioned org. Best-effort —
// callers should not block signup on this. Picks the cheapest model in the
// provider's enabled list (the `:free` OpenRouter model when present).
export async function autoProvisionStarterAgent(
  orgId: string,
  providerId: string,
  models: string[],
): Promise<void> {
  const free = models.find((m) => m.toLowerCase().includes(":free"));
  const fallback = models[0];
  const model = free ?? fallback;
  if (!model) return;

  const id = newId("agent");
  const promptId = newId("prm");

  await insertAgent({
    id,
    orgId,
    name: "Hello",
    role: free ? "Free-tier assistant" : "Sample assistant",
    description: free
      ? "Free-tier sample agent powered by OpenRouter's :free model. Rate-limited but costs nothing."
      : "Sample assistant pre-wired to your default provider.",
    executionMode: "one_shot",
    providerId,
    model,
    currentPromptVersion: "v1",
    tools: [],
    limits: {
      max_steps: 4,
      max_runtime_ms: 30_000,
      max_tool_calls: 0,
      max_tokens_per_run: 4_000,
    },
    intro: [
      `Hi — I'm a sample agent running on ${model}.`,
      "Say anything to test the chat round-trip end-to-end.",
    ],
    skills: [
      {
        label: "Tell me a fact",
        description: "Pick a topic and I'll surface one interesting fact.",
        try_first: true,
      },
      {
        label: "Help me write something",
        description: "Drafts, summaries, or rewrites — paste your text.",
      },
      {
        label: "Explain a concept",
        description: "Plain-language walkthroughs of jargon-heavy topics.",
      },
    ],
    inputSchema: null,
    outputSchema: null,
  });

  await insertPromptVersion(
    promptId,
    id,
    "v1",
    "You are a friendly, concise assistant. Answer in 1–3 short paragraphs.",
    "",
    "",
    "Created with agent",
  );
}

export async function getPromptVersions(orgId: string, agentId: string) {
  const agent = await getAgent(orgId, agentId);
  if (!agent) throw new AgentError("not_found", "Agent not found.");
  return listPromptVersions(orgId, agentId);
}
