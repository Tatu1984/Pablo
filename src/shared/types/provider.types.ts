export type ProviderType =
  | "openrouter"
  | "openai"
  | "anthropic"
  | "google"
  | "bedrock"
  | "openai_compatible"
  | "ollama";

export interface Provider {
  id: string;
  name: string;
  type: ProviderType;
  base_url: string | null;
  key_prefix: string | null;
  models: string[];
  status: "active" | "error" | "disabled";
  created_at: string;
  last_used_at: string | null;
  byo: boolean;
}
