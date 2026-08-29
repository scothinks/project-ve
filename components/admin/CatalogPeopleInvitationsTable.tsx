"use client";

import { AdminConfirmDialog } from "@/components/admin/AdminDialog";
import { revokeCatalogInvitation } from "@/app/admin/catalog-people/actions";
import { ORGANIZATION_ROLE_LABELS } from "@/features/organizations/shared/roles";
import type { AdminCatalogStaffInvitation } from "@/lib/admin";
import { formatRewardDate } from "@/lib/rewards";

function statusToneClasses(status: string) {
  if (status === "pending") {
    return "bg-[color:color-mix(in_srgb,var(--admin-tertiary-fixed)_60%,transparent)] text-[var(--admin-on-tertiary-fixed-variant)]";
  }
  if (status === "accepted") {
    return "bg-[color:color-mix(in_srgb,var(--admin-primary-container)_16%,transparent)] text-[var(--admin-primary)]";
  }
  if (status === "expired" || status === "revoked" || status === "declined") {
    return "bg-[var(--admin-error-container)] text-[var(--admin-on-error-container)]";
  }
  return "bg-[var(--admin-surface-container-high)] text-[var(--admin-on-surface-variant)]";
}

export function CatalogPeopleInvitationsTable({
  invitations,
}: {
  invitations: AdminCatalogStaffInvitation[];
}) {
  if (invitations.length === 0) {
    return (
      <p className="py-10 text-center text-sm font-semibold text-[var(--admin-on-surface-variant)]">
        No invitations sent yet.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-[18px] border border-[var(--admin-border-warm)]">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-[var(--admin-surface-container-low)] text-xs font-black uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]">
            <tr>
              <th className="whitespace-nowrap px-4 py-3">Recipient</th>
              <th className="whitespace-nowrap px-4 py-3">Role</th>
              <th className="whitespace-nowrap px-4 py-3">Status</th>
              <th className="whitespace-nowrap px-4 py-3">Expires</th>
              <th className="whitespace-nowrap px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)]">
            {invitations.map((invitation) => (
              <tr key={invitation.id}>
                <td className="whitespace-nowrap px-4 py-3 font-bold text-[var(--admin-on-surface)]">
                  {invitation.email ?? invitation.profile?.display_name ?? "Unknown recipient"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-[var(--admin-on-surface-variant)]">
                  {ORGANIZATION_ROLE_LABELS[invitation.role]}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold capitalize ${statusToneClasses(invitation.status)}`}>
                    {invitation.status}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-[var(--admin-on-surface-variant)]">
                  {formatRewardDate(invitation.expires_at)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  {invitation.status === "pending" ? (
                    <AdminConfirmDialog
                      confirmLabel="Revoke"
                      description={`This invitation for ${invitation.email ?? "this recipient"} will no longer be usable.`}
                      onConfirm={() => {
                        const formData = new FormData();
                        formData.set("invitationId", invitation.id);
                        void revokeCatalogInvitation(formData);
                      }}
                      title="Revoke invitation?"
                      trigger={
                        <button
                          className="text-sm font-bold text-[var(--admin-error)] hover:underline"
                          type="button"
                        >
                          Revoke
                        </button>
                      }
                      tone="danger"
                    />
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
