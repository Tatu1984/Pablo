import PageFrame from "@/frontend/components/layout/PageFrame";
import PageHeader from "@/frontend/components/layout/PageHeader";
import NewAgentForm from "@/frontend/components/features/agents/NewAgentForm";
import { getProviders } from "@/backend/repositories/provider.repository";
import { requireSession } from "@/backend/services/session.service";

export default async function NewAgentPage() {
  const { org } = await requireSession();
  const providers = await getProviders(org.id);
  return (
    <PageFrame>
      <PageHeader
        crumbs={[{ href: "/agents", label: "Agents" }, { label: "New" }]}
        title="Create agent"
        description="A name, an input schema, a tool allowlist, and hard limits. Prompt versions are edited separately after creation."
      />
      <NewAgentForm providers={providers} />
    </PageFrame>
  );
}
