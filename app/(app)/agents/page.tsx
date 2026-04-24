import { redirect } from "next/navigation";
import { AGENTS } from "@/lib/mock";

export default function AgentsIndex() {
  if (AGENTS.length > 0) redirect(`/agents/${AGENTS[0].id}`);
  redirect("/agents/new");
}
