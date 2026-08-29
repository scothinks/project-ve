"use client";

import { useState } from "react";
import { PeopleMemberDetailDrawer } from "@/components/admin/PeopleMemberDetailDrawer";
import { ORGANIZATION_ROLE_LABELS } from "@/features/organizations/shared/roles";
import type { AdminOrganizationUnitRow, AdminPeopleMember } from "@/lib/admin";

function statusToneClasses(status: string) {
  if (status === "active") {
    return "bg-[color:color-mix(in_srgb,var(--admin-primary-container)_16%,transparent)] text-[var(--admin-primary)]";
  }
  if (status === "invited") {
    return "bg-[color:color-mix(in_srgb,var(--admin-tertiary-fixed)_60%,transparent)] text-[var(--admin-on-tertiary-fixed-variant)]";
  }
  if (status === "suspended" || status === "removed") {
    return "bg-[var(--admin-error-container)] text-[var(--admin-on-error-container)]";
  }
  return "bg-[var(--admin-surface-container-high)] text-[var(--admin-on-surface-variant)]";
}

function initialsFor(name: string | null | undefined) {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "?";
  return trimmed
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function PeopleMembersTable({
  members,
  organizationId,
  units,
}: {
  members: AdminPeopleMember[];
  organizationId: string;
  units: AdminOrganizationUnitRow[];
}) {
  const [activeMember, setActiveMember] = useState<AdminPeopleMember | null>(null);

  if (members.length === 0) {
    return (
      <p className="py-10 text-center text-sm font-semibold text-[var(--admin-on-surface-variant)]">
        No members match these filters.
      </p>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-[18px] border border-[var(--admin-border-warm)]">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-[var(--admin-surface-container-low)] text-xs font-black uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]">
              <tr>
                <th className="whitespace-nowrap px-4 py-3">Identity</th>
                <th className="whitespace-nowrap px-4 py-3">Role</th>
                <th className="whitespace-nowrap px-4 py-3">Status</th>
                <th className="whitespace-nowrap px-4 py-3">Unit</th>
                <th className="whitespace-nowrap px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)]">
              {members.map((member) => {
                const displayName = member.profile?.display_name ?? "Unnamed member";
                return (
                  <tr
                    className="cursor-pointer transition hover:bg-[var(--admin-surface-container-low)]"
                    key={member.id}
                    onClick={() => setActiveMember(member)}
                  >
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--admin-surface-container-low)] text-xs font-black text-[var(--admin-on-surface-variant)]">
                          {member.profile?.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img alt={displayName} className="h-full w-full object-cover" src={member.profile.avatar_url} />
                          ) : (
                            initialsFor(displayName)
                          )}
                        </div>
                        <span className="font-bold text-[var(--admin-on-surface)]">{displayName}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[var(--admin-on-surface-variant)]">
                      {ORGANIZATION_ROLE_LABELS[member.role]}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold capitalize ${statusToneClasses(member.status)}`}>
                        {member.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[var(--admin-on-surface-variant)]">
                      {member.unitNames.length > 0 ? member.unitNames.join(", ") : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <span className="text-sm font-bold text-[var(--admin-primary)]">View details</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {activeMember ? (
        <PeopleMemberDetailDrawer
          member={activeMember}
          onOpenChange={(open) => {
            if (!open) setActiveMember(null);
          }}
          open={Boolean(activeMember)}
          units={units}
          organizationId={organizationId}
        />
      ) : null}
    </>
  );
}
