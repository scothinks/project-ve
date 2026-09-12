"use client";

import { AdminConfirmDialog } from "@/components/admin/AdminDialog";
import { revokeInvitation } from "@/app/admin/people/actions";
import { ORGANIZATION_ROLE_LABELS } from "@/features/organizations/shared/roles";
import type { AdminOrganizationInvitationRow } from "@/lib/admin";
import { formatRewardDate } from "@/lib/rewards";

function statusToneClasses(status: string) {
  if (status === "pending") {
    return "bg-[color:color-mix(in_srgb,var(--ui-warning-bg)_60%,transparent)] text-[var(--ui-warning)]";
  }
  if (status === "accepted") {
    return "bg-[color:color-mix(in_srgb,var(--ui-success)_16%,transparent)] text-[var(--ui-success)]";
  }
  if (status === "expired" || status === "revoked" || status === "declined") {
    return "bg-[var(--ui-danger-bg)] text-[var(--ui-danger)]";
  }
  return "bg-[var(--ui-surface-raised)] text-[var(--ui-text-muted)]";
}

function targetLabel(invitation: AdminOrganizationInvitationRow) {
  if (invitation.target_type === "organization") return "Whole organisation";
  return `${invitation.target_type === "programme" ? "Programme" : "Cohort"} · ${invitation.target_id ?? "—"}`;
}

export function PeopleInvitationsTable({
  invitations,
  organizationId,
}: {
  invitations: AdminOrganizationInvitationRow[];
  organizationId: string;
}) {
  if (invitations.length === 0) {
    return (
      <p className="py-10 text-center text-sm font-semibold text-[var(--ui-text-muted)]">
        No invitations sent yet.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-[18px] border border-[var(--ui-border-subtle)]">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-[var(--ui-surface-soft)] text-xs font-black uppercase tracking-[0.1em] text-[var(--ui-text-muted)]">
            <tr>
              <th className="whitespace-nowrap px-4 py-3">Recipient</th>
              <th className="whitespace-nowrap px-4 py-3">Role</th>
              <th className="whitespace-nowrap px-4 py-3">Target</th>
              <th className="whitespace-nowrap px-4 py-3">Status</th>
              <th className="whitespace-nowrap px-4 py-3">Expires</th>
              <th className="whitespace-nowrap px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--ui-border-subtle)] bg-[var(--ui-surface)]">
            {invitations.map((invitation) => (
              <tr key={invitation.id}>
                <td className="whitespace-nowrap px-4 py-3 font-bold text-[var(--ui-text)]">
                  {invitation.email ?? invitation.profile?.display_name ?? "Unknown recipient"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-[var(--ui-text-muted)]">
                  {ORGANIZATION_ROLE_LABELS[invitation.role]}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-[var(--ui-text-muted)]">
                  {targetLabel(invitation)}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold capitalize ${statusToneClasses(invitation.status)}`}>
                    {invitation.status}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-[var(--ui-text-muted)]">
                  {formatRewardDate(invitation.expires_at)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  {invitation.status === "pending" ? (
                    <AdminConfirmDialog
                      confirmLabel="Revoke"
                      description={`This invitation for ${invitation.email ?? "this recipient"} will no longer be usable.`}
                      onConfirm={() => {
                        const formData = new FormData();
                        formData.set("organizationId", organizationId);
                        formData.set("invitationId", invitation.id);
                        void revokeInvitation(formData);
                      }}
                      title="Revoke invitation?"
                      trigger={
                        <button
                          className="text-sm font-bold text-[var(--ui-danger)] hover:underline"
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
