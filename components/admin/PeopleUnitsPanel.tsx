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
        <p className="text-sm text-[var(--ui-text-muted)]">
          Units group members into departments, faculties, or teams for reporting and assignment.
        </p>
        <AdminDrawer
          description="Units group members for reporting and assignment."
          onOpenChange={setOpen}
          open={open}
          title="New Unit"
          trigger={
            <button
              className="inline-flex items-center gap-2 rounded-full border border-[var(--ui-border-subtle)] bg-[var(--ui-surface)] px-4 py-2 text-sm font-bold text-[var(--ui-text)] transition hover:bg-[var(--ui-surface-soft)]"
              type="button"
            >
              New Unit
            </button>
          }
        >
          <form action={saveUnit} className="flex flex-col gap-5">
            <input name="organizationId" type="hidden" value={organizationId} />
            <label className="flex flex-col gap-2">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ui-text-muted)]">
                Name
              </span>
              <input
                className="rounded-[14px] border border-[var(--ui-control-border)] bg-[var(--ui-surface-inset)] px-4 py-3 text-sm font-semibold outline-none transition focus:border-[var(--ui-focus)]"
                name="name"
                placeholder="Department of Ethics"
                required
                type="text"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ui-text-muted)]">
                Unit Type
              </span>
              <input
                className="rounded-[14px] border border-[var(--ui-control-border)] bg-[var(--ui-surface-inset)] px-4 py-3 text-sm font-semibold outline-none transition focus:border-[var(--ui-focus)]"
                defaultValue="department"
                name="unitType"
                required
                type="text"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-[var(--ui-text-muted)]">
                Parent Unit
              </span>
              <select
                className="rounded-[14px] border border-[var(--ui-control-border)] bg-[var(--ui-surface-inset)] px-4 py-3 text-sm font-semibold outline-none transition focus:border-[var(--ui-focus)]"
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
            <div className="flex justify-end gap-3 border-t border-[var(--ui-border-subtle)] pt-4">
              <button
                className="rounded-[12px] border border-[var(--ui-border-subtle)] px-4 py-2 text-sm font-bold text-[var(--ui-text)] transition hover:bg-[var(--ui-surface-soft)]"
                onClick={() => setOpen(false)}
                type="button"
              >
                Cancel
              </button>
              <PendingSubmitButton
                className="rounded-full bg-[var(--ui-action)] px-5 py-2 text-sm font-bold text-[var(--ui-on-action)] transition hover:brightness-95"
                label="Create Unit"
                pendingLabel="Creating…"
                type="submit"
              />
            </div>
          </form>
        </AdminDrawer>
      </div>

      {units.length === 0 ? (
        <p className="py-10 text-center text-sm font-semibold text-[var(--ui-text-muted)]">
          No units yet. Create one to start organising members.
        </p>
      ) : (
        <div className="overflow-hidden rounded-[18px] border border-[var(--ui-border-subtle)]">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-[var(--ui-surface-soft)] text-xs font-black uppercase tracking-[0.1em] text-[var(--ui-text-muted)]">
              <tr>
                <th className="whitespace-nowrap px-4 py-3">Name</th>
                <th className="whitespace-nowrap px-4 py-3">Type</th>
                <th className="whitespace-nowrap px-4 py-3">Members</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--ui-border-subtle)] bg-[var(--ui-surface)]">
              {units.map((unit) => (
                <tr key={unit.id}>
                  <td className="whitespace-nowrap px-4 py-3 font-bold text-[var(--ui-text)]">{unit.name}</td>
                  <td className="whitespace-nowrap px-4 py-3 capitalize text-[var(--ui-text-muted)]">
                    {unit.unit_type}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[var(--ui-text-muted)]">
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
