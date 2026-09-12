"use client";

import * as Switch from "@radix-ui/react-switch";
import { useState } from "react";
import { AdminConfirmDialog, AdminDrawer } from "@/components/admin/AdminDialog";
import { PendingSubmitButton } from "@/components/admin/PendingSubmitButton";
import { saveCatalogMembership } from "@/app/admin/catalog-people/actions";
import { ORGANIZATION_ROLE_DESCRIPTIONS, ORGANIZATION_ROLE_LABELS } from "@/features/organizations/shared/roles";
import type { AdminCatalogStaffMember } from "@/lib/admin";
import type { Database } from "@/types/database";

type OrganizationRoleKey = Database["public"]["Enums"]["organization_role_key"];

const ROLE_ORDER: OrganizationRoleKey[] = [
  "organisation_owner",
  "organisation_admin",
  "programme_manager",
  "content_editor",
  "reviewer",
  "report_viewer",
];

export function CatalogPeopleMemberDetailDrawer({
  member,
  onOpenChange,
  open,
}: {
  member: AdminCatalogStaffMember;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const [selectedRole, setSelectedRole] = useState<OrganizationRoleKey>(member.role);
  const [suspended, setSuspended] = useState(member.status === "suspended");
  const displayName = member.profile?.display_name ?? "Staff member";

  return (
    <AdminDrawer
      description={ORGANIZATION_ROLE_LABELS[member.role]}
      onOpenChange={onOpenChange}
      open={open}
      title={displayName}
    >
      <form action={saveCatalogMembership} className="flex flex-col gap-6">
        <input name="userId" type="hidden" value={member.user_id} />
        <input name="role" type="hidden" value={selectedRole} />
        <input name="status" type="hidden" value={suspended ? "suspended" : "active"} />

        <section>
          <h3 className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ui-text-muted)]">
            Access
          </h3>
          <div className="mt-2 flex items-center justify-between rounded-[14px] border border-[var(--ui-border-subtle)] p-3">
            <div>
              <p className="text-sm font-bold text-[var(--ui-text)]">Catalog Access</p>
              <p className="text-xs text-[var(--ui-text-muted)]">
                Suspend to block catalog access without removing this person.
              </p>
            </div>
            <Switch.Root
              checked={!suspended}
              className="relative h-6 w-11 shrink-0 rounded-full bg-[var(--ui-text-muted)] transition data-[state=checked]:bg-[var(--ui-current-rail)]"
              onCheckedChange={(checked) => setSuspended(!checked)}
            >
              <Switch.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-[var(--ui-surface)] shadow transition data-[state=checked]:bg-[var(--ui-on-action)] data-[state=checked]:translate-x-[22px]" />
            </Switch.Root>
          </div>
          {member.status !== "removed" ? (
            <div className="mt-3 rounded-[14px] border border-[color:color-mix(in_srgb,var(--ui-danger)_24%,var(--ui-border-subtle))] bg-[color:color-mix(in_srgb,var(--ui-danger-bg)_40%,var(--ui-surface))] p-3">
              <p className="text-sm font-bold text-[var(--ui-danger)]">Remove Staff Member</p>
              <p className="mt-1 text-xs text-[var(--ui-danger)] opacity-90">
                Permanently remove this person from the platform catalog. This action cannot be undone.
              </p>
              <AdminConfirmDialog
                confirmLabel="Remove staff member"
                description={`${displayName} will lose access to the platform catalog immediately. This cannot be undone.`}
                onConfirm={() => {
                  const formData = new FormData();
                  formData.set("userId", member.user_id);
                  formData.set("role", selectedRole);
                  formData.set("status", "removed");
                  void saveCatalogMembership(formData);
                }}
                title="Remove staff member?"
                trigger={
                  <button
                    className="mt-3 rounded-full border border-[var(--ui-danger)] bg-[var(--ui-surface)] px-3 py-1.5 text-xs font-bold text-[var(--ui-danger)] transition hover:bg-[var(--ui-danger)] hover:text-[var(--ui-on-danger)]"
                    type="button"
                  >
                    Remove Staff Member
                  </button>
                }
                tone="danger"
              />
            </div>
          ) : null}
        </section>

        <section>
          <h3 className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ui-text-muted)]">
            Role &amp; Permissions
          </h3>
          <div className="mt-2 flex flex-col gap-2">
            {ROLE_ORDER.map((role) => (
              <label
                className="flex cursor-pointer items-start gap-3 rounded-[14px] border border-[var(--ui-border-subtle)] p-3 transition has-[:checked]:border-[var(--ui-action)] has-[:checked]:bg-[color:color-mix(in_srgb,var(--ui-action)_8%,transparent)]"
                key={role}
              >
                <input
                  checked={selectedRole === role}
                  className="mt-1"
                  name="roleRadio"
                  onChange={() => setSelectedRole(role)}
                  type="radio"
                  value={role}
                />
                <span>
                  <span className="block text-sm font-bold text-[var(--ui-text)]">
                    {ORGANIZATION_ROLE_LABELS[role]}
                    {role === member.role ? (
                      <span className="ml-2 text-[10px] font-black uppercase tracking-wide text-[var(--ui-action)]">
                        Current
                      </span>
                    ) : null}
                  </span>
                  <span className="text-xs text-[var(--ui-text-muted)]">
                    {ORGANIZATION_ROLE_DESCRIPTIONS[role]}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </section>

        <div className="flex justify-end gap-3 border-t border-[var(--ui-border-subtle)] pt-4">
          <button
            className="rounded-[12px] border border-[var(--ui-border-subtle)] px-4 py-2 text-sm font-bold text-[var(--ui-text)] transition hover:bg-[var(--ui-surface-soft)]"
            onClick={() => onOpenChange(false)}
            type="button"
          >
            Cancel
          </button>
          <PendingSubmitButton
            className="rounded-[12px] bg-[var(--ui-action)] px-4 py-2 text-sm font-bold text-[var(--ui-on-action)] transition hover:brightness-95"
            label="Save Changes"
            pendingLabel="Saving…"
            type="submit"
          />
        </div>
      </form>
    </AdminDrawer>
  );
}
