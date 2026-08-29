"use client";

import { useState } from "react";
import { AdminDrawer } from "@/components/admin/AdminDialog";
import { PendingSubmitButton } from "@/components/admin/PendingSubmitButton";
import { saveUnit } from "@/app/admin/people/actions";
import type { AdminOrganizationUnitRow } from "@/lib/admin";

export function PeopleUnitsPanel({
  organizationId,
  units,
}: {
  organizationId: string;
  units: AdminOrganizationUnitRow[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--admin-on-surface-variant)]">
          Units group members into departments, faculties, or teams for reporting and assignment.
        </p>
        <AdminDrawer
          description="Units group members for reporting and assignment."
          onOpenChange={setOpen}
          open={open}
          title="New Unit"
          trigger={
            <button
              className="inline-flex items-center gap-2 rounded-full border border-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)] px-4 py-2 text-sm font-bold text-[var(--admin-on-surface)] transition hover:bg-[var(--admin-surface-container-low)]"
              type="button"
            >
              New Unit
            </button>
          }
        >
          <form action={saveUnit} className="flex flex-col gap-5">
            <input name="organizationId" type="hidden" value={organizationId} />
            <label className="flex flex-col gap-2">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-[var(--admin-on-surface-variant)]">
                Name
              </span>
              <input
                className="rounded-[14px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface)] px-4 py-3 text-sm font-semibold outline-none transition focus:border-[var(--admin-primary-container)]"
                name="name"
                placeholder="Department of Ethics"
                required
                type="text"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-[var(--admin-on-surface-variant)]">
                Unit Type
              </span>
              <input
                className="rounded-[14px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface)] px-4 py-3 text-sm font-semibold outline-none transition focus:border-[var(--admin-primary-container)]"
                defaultValue="department"
                name="unitType"
                required
                type="text"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-[var(--admin-on-surface-variant)]">
                Parent Unit
              </span>
              <select
                className="rounded-[14px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface)] px-4 py-3 text-sm font-semibold outline-none transition focus:border-[var(--admin-primary-container)]"
                defaultValue=""
                name="parentUnitId"
              >
                <option value="">No parent (top-level)</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex justify-end gap-3 border-t border-[var(--admin-border-warm)] pt-4">
              <button
                className="rounded-[12px] border border-[var(--admin-border-warm)] px-4 py-2 text-sm font-bold text-[var(--admin-on-surface)] transition hover:bg-[var(--admin-surface-container-low)]"
                onClick={() => setOpen(false)}
                type="button"
              >
                Cancel
              </button>
              <PendingSubmitButton
                className="rounded-full bg-[var(--admin-primary-container)] px-5 py-2 text-sm font-bold text-[var(--admin-on-primary)] transition hover:brightness-95"
                label="Create Unit"
                pendingLabel="Creating…"
                type="submit"
              />
            </div>
          </form>
        </AdminDrawer>
      </div>

      {units.length === 0 ? (
        <p className="py-10 text-center text-sm font-semibold text-[var(--admin-on-surface-variant)]">
          No units yet. Create one to start organising members.
        </p>
      ) : (
        <div className="overflow-hidden rounded-[18px] border border-[var(--admin-border-warm)]">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-[var(--admin-surface-container-low)] text-xs font-black uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]">
              <tr>
                <th className="whitespace-nowrap px-4 py-3">Name</th>
                <th className="whitespace-nowrap px-4 py-3">Type</th>
                <th className="whitespace-nowrap px-4 py-3">Members</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--admin-border-warm)] bg-[var(--admin-surface-milk)]">
              {units.map((unit) => (
                <tr key={unit.id}>
                  <td className="whitespace-nowrap px-4 py-3 font-bold text-[var(--admin-on-surface)]">{unit.name}</td>
                  <td className="whitespace-nowrap px-4 py-3 capitalize text-[var(--admin-on-surface-variant)]">
                    {unit.unit_type}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[var(--admin-on-surface-variant)]">
                    {unit.active_member_count ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
