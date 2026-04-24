// Centralised access to environment variables with a tiny "required" check.
// Keep reads through this module so a missing var fails loudly at startup
// rather than mysteriously later.

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function optional(name: string): string | undefined {
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
}

export const env = {
  DATABASE_URL: required("DATABASE_URL"),
  JWT_SECRET: optional("JWT_SECRET"),
  PROVIDER_ENCRYPTION_KEY: optional("PROVIDER_ENCRYPTION_KEY"),
  NEXT_PUBLIC_APP_URL: optional("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000",
  OPENROUTER_API_KEY: optional("OPENROUTER_API_KEY"),
  OPENROUTER_BASE_URL: optional("OPENROUTER_BASE_URL") ?? "https://openrouter.ai/api/v1",
  REDIS_URL: optional("REDIS_URL"),
  LOG_LEVEL: optional("LOG_LEVEL") ?? "info",
};
