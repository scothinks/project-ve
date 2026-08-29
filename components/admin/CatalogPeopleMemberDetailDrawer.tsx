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
          <h3 className="text-xs font-black uppercase tracking-[0.14em] text-[var(--admin-on-surface-variant)]">
            Access
          </h3>
          <div className="mt-2 flex items-center justify-between rounded-[14px] border border-[var(--admin-border-warm)] p-3">
            <div>
              <p className="text-sm font-bold text-[var(--admin-on-surface)]">Catalog Access</p>
              <p className="text-xs text-[var(--admin-on-surface-variant)]">
                Suspend to block catalog access without removing this person.
              </p>
            </div>
            <Switch.Root
              checked={!suspended}
              className="relative h-6 w-11 shrink-0 rounded-full bg-[var(--admin-surface-container-high)] transition data-[state=checked]:bg-[var(--admin-primary-container)]"
              onCheckedChange={(checked) => setSuspended(!checked)}
            >
              <Switch.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition data-[state=checked]:translate-x-[22px]" />
            </Switch.Root>
          </div>
          {member.status !== "removed" ? (
            <div className="mt-3 rounded-[14px] border border-[color:color-mix(in_srgb,var(--admin-error)_24%,var(--admin-border-warm))] bg-[color:color-mix(in_srgb,var(--admin-error-container)_40%,var(--admin-surface-milk))] p-3">
              <p className="text-sm font-bold text-[var(--admin-on-error-container)]">Remove Staff Member</p>
              <p className="mt-1 text-xs text-[var(--admin-on-error-container)] opacity-90">
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
                    className="mt-3 rounded-full border border-[var(--admin-error)] bg-[var(--admin-surface-milk)] px-3 py-1.5 text-xs font-bold text-[var(--admin-error)] transition hover:bg-[var(--admin-error)] hover:text-white"
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
          <h3 className="text-xs font-black uppercase tracking-[0.14em] text-[var(--admin-on-surface-variant)]">
            Role &amp; Permissions
          </h3>
          <div className="mt-2 flex flex-col gap-2">
            {ROLE_ORDER.map((role) => (
              <label
                className="flex cursor-pointer items-start gap-3 rounded-[14px] border border-[var(--admin-border-warm)] p-3 transition has-[:checked]:border-[var(--admin-primary-container)] has-[:checked]:bg-[color:color-mix(in_srgb,var(--admin-primary-container)_8%,transparent)]"
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
                  <span className="block text-sm font-bold text-[var(--admin-on-surface)]">
                    {ORGANIZATION_ROLE_LABELS[role]}
                    {role === member.role ? (
                      <span className="ml-2 text-[10px] font-black uppercase tracking-wide text-[var(--admin-primary)]">
                        Current
                      </span>
                    ) : null}
                  </span>
                  <span className="text-xs text-[var(--admin-on-surface-variant)]">
                    {ORGANIZATION_ROLE_DESCRIPTIONS[role]}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </section>

        <div className="flex justify-end gap-3 border-t border-[var(--admin-border-warm)] pt-4">
          <button
            className="rounded-[12px] border border-[var(--admin-border-warm)] px-4 py-2 text-sm font-bold text-[var(--admin-on-surface)] transition hover:bg-[var(--admin-surface-container-low)]"
            onClick={() => onOpenChange(false)}
            type="button"
          >
            Cancel
          </button>
          <PendingSubmitButton
            className="rounded-[12px] bg-[var(--admin-primary-container)] px-4 py-2 text-sm font-bold text-[var(--admin-on-primary)] transition hover:brightness-95"
            label="Save Changes"
            pendingLabel="Saving…"
            type="submit"
          />
        </div>
      </form>
    </AdminDrawer>
  );
}
