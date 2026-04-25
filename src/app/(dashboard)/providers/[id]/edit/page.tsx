import { notFound } from "next/navigation";
import PageFrame from "@/frontend/components/layout/PageFrame";
import PageHeader from "@/frontend/components/layout/PageHeader";
import ProviderBadge from "@/frontend/components/ui/ProviderBadge";
import EditProviderForm from "@/frontend/components/features/providers/EditProviderForm";
import { getProvider } from "@/backend/repositories/provider.repository";
import { requireSession } from "@/backend/services/session.service";

export default async function EditProviderPage({ params }: { params: { id: string } }) {
  const { org } = await requireSession();
  const provider = await getProvider(org.id, params.id);
  if (!provider) notFound();

  return (
    <PageFrame>
      <PageHeader
        crumbs={[
          { href: "/providers", label: "Providers" },
          { label: "Edit" },
        ]}
        title={provider.name}
        description="Rotate the API key, prune the model list, or disable the provider. Changes do not affect runs already in flight."
        actions={<ProviderBadge type={provider.type} />}
      />
      <EditProviderForm provider={provider} />
    </PageFrame>
  );
}
