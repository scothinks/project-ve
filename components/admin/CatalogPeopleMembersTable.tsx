"use client";

import { useState } from "react";
import { CatalogPeopleMemberDetailDrawer } from "@/components/admin/CatalogPeopleMemberDetailDrawer";
import { ORGANIZATION_ROLE_LABELS } from "@/features/organizations/shared/roles";
import type { AdminCatalogStaffMember } from "@/lib/admin";

function statusToneClasses(status: string) {
  if (status === "active") {
    return "bg-[color:color-mix(in_srgb,var(--ui-success)_16%,transparent)] text-[var(--ui-success)]";
  }
  if (status === "invited") {
    return "bg-[color:color-mix(in_srgb,var(--ui-warning-bg)_60%,transparent)] text-[var(--ui-warning)]";
  }
  if (status === "suspended" || status === "removed") {
    return "bg-[var(--ui-danger-bg)] text-[var(--ui-danger)]";
  }
  return "bg-[var(--ui-surface-raised)] text-[var(--ui-text-muted)]";
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

export function CatalogPeopleMembersTable({ members }: { members: AdminCatalogStaffMember[] }) {
  const [activeMember, setActiveMember] = useState<AdminCatalogStaffMember | null>(null);

  if (members.length === 0) {
    return (
      <p className="py-10 text-center text-sm font-semibold text-[var(--ui-text-muted)]">
        No catalog staff yet.
      </p>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-[18px] border border-[var(--ui-border-subtle)]">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-[var(--ui-surface-soft)] text-xs font-black uppercase tracking-[0.1em] text-[var(--ui-text-muted)]">
              <tr>
                <th className="whitespace-nowrap px-4 py-3">Identity</th>
                <th className="whitespace-nowrap px-4 py-3">Role</th>
                <th className="whitespace-nowrap px-4 py-3">Status</th>
                <th className="whitespace-nowrap px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--ui-border-subtle)] bg-[var(--ui-surface)]">
              {members.map((member) => {
                const displayName = member.profile?.display_name ?? "Unnamed staff member";
                return (
                  <tr
                    className="cursor-pointer transition hover:bg-[var(--ui-surface-soft)]"
                    key={member.id}
                    onClick={() => setActiveMember(member)}
                  >
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--ui-surface-soft)] text-xs font-black text-[var(--ui-text-muted)]">
                          {member.profile?.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img alt={displayName} className="h-full w-full object-cover" src={member.profile.avatar_url} />
                          ) : (
                            initialsFor(displayName)
                          )}
                        </div>
                        <span className="font-bold text-[var(--ui-text)]">{displayName}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[var(--ui-text-muted)]">
                      {ORGANIZATION_ROLE_LABELS[member.role]}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold capitalize ${statusToneClasses(member.status)}`}>
                        {member.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <span className="text-sm font-bold text-[var(--ui-action)]">View details</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {activeMember ? (
        <CatalogPeopleMemberDetailDrawer
          member={activeMember}
          onOpenChange={(open) => {
            if (!open) setActiveMember(null);
          }}
          open={Boolean(activeMember)}
        />
      ) : null}
    </>
  );
}
