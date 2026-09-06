import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { MediaPickerProvider } from "@/components/admin/MediaPickerProvider";
import { getAdminOrganizationContexts, requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { profile, supabase, workspace } = await requireAdmin();
  const organizationContexts = await getAdminOrganizationContexts(supabase, profile.id, profile);

  return (
    <MediaPickerProvider key={workspace.id}>
      <AdminShell
        currentWorkspace={workspace}
        organizationContexts={organizationContexts}
        profile={profile}
      >
        {children}
      </AdminShell>
    </MediaPickerProvider>
  );
}
