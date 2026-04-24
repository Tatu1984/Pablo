import { redirect } from "next/navigation";
import AppShell from "@/frontend/components/layout/AppShell";
import { getAgents } from "@/backend/repositories/agent.repository";
import { currentSession } from "@/backend/services/session.service";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Defence in depth — middleware already gates, but server components render
  // independently of middleware so we check again here.
  const session = await currentSession();
  if (!session) redirect("/login");

  const agents = await getAgents(session.org.id);
  return (
    <AppShell
      agents={agents}
      user={{ email: session.user.email, orgName: session.org.name }}
    >
      {children}
    </AppShell>
  );
}
