import { redirect } from "next/navigation";
import { getAgents } from "@/backend/repositories/agent.repository";
import { requireSession } from "@/backend/services/session.service";

export default async function AgentsIndex() {
  const { org } = await requireSession();
  const agents = await getAgents(org.id);
  if (agents.length > 0) redirect(`/agents/${agents[0].id}`);
  redirect("/agents/new");
}
