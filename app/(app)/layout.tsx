import AppShell from "@/components/AppShell";
import { getAgents } from "@/lib/queries";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const agents = await getAgents();
  return <AppShell agents={agents}>{children}</AppShell>;
}
