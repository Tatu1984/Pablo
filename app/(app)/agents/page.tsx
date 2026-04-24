import { redirect } from "next/navigation";
import { getAgents } from "@/lib/queries";

export default async function AgentsIndex() {
  const agents = await getAgents();
  if (agents.length > 0) redirect(`/agents/${agents[0].id}`);
  redirect("/agents/new");
}
