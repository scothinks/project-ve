"use client";

import { useEffect, useState } from "react";
import { AdminDrawer } from "@/components/admin/AdminDialog";
import { PendingSubmitButton } from "@/components/admin/PendingSubmitButton";
import { searchCatalogInviteCandidates, sendCatalogInvitation } from "@/app/admin/catalog-people/actions";
import { ORGANIZATION_ROLE_LABELS } from "@/features/organizations/shared/roles";
import type { Database } from "@/types/database";

type OrganizationRoleKey = Database["public"]["Enums"]["organization_role_key"];
type InviteCandidate = { id: string; displayName: string };

const ROLE_GRID: OrganizationRoleKey[] = [
  "organisation_owner",
  "organisation_admin",
  "programme_manager",
  "content_editor",
  "reviewer",
  "report_viewer",
];

function InviteMethodTab({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`flex-1 rounded-[12px] px-3 py-2 text-sm font-bold transition ${
        active
          ? "bg-[var(--admin-surface-milk)] text-[var(--admin-on-surface)] shadow-sm"
          : "text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

export function CatalogPeopleInviteDrawer({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [role, setRole] = useState<OrganizationRoleKey>("content_editor");
  const [method, setMethod] = useState<"email" | "existing">("email");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<InviteCandidate[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<InviteCandidate | null>(null);

  useEffect(() => {
    if (method !== "existing" || query.trim().length < 2) {
      setResults([]);
      return;
    }

    let cancelled = false;
    setIsSearching(true);
    const timer = setTimeout(() => {
      void searchCatalogInviteCandidates(query)
        .then((candidates) => {
          if (!cancelled) setResults(candidates);
        })
        .finally(() => {
          if (!cancelled) setIsSearching(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [method, query]);

  return (
    <AdminDrawer
      description="Add someone to Project VE's platform catalogue staff."
      onOpenChange={setOpen}
      open={open}
      title="Invite Catalog Staff"
      trigger={
        <button
          className="inline-flex items-center gap-2 rounded-full bg-[var(--admin-primary-container)] px-4 py-2 text-sm font-bold text-[var(--admin-on-primary)] shadow-sm transition hover:brightness-95"
          type="button"
        >
          Invite Staff
        </button>
      }
    >
      <form action={sendCatalogInvitation} className="flex flex-col gap-6">
        <input name="role" type="hidden" value={role} />
        {method === "existing" && selectedUser ? (
          <input name="invitedUserId" type="hidden" value={selectedUser.id} />
        ) : null}

        <div>
          <span className="text-xs font-black uppercase tracking-[0.14em] text-[var(--admin-on-surface-variant)]">
            Invitation Method
          </span>
          <div className="mt-2 flex gap-1 rounded-[14px] bg-[var(--admin-surface-container-low)] p-1">
            <InviteMethodTab
              active={method === "email"}
              label="Invite by Email"
              onClick={() => {
                setMethod("email");
                setSelectedUser(null);
              }}
            />
            <InviteMethodTab
              active={method === "existing"}
              label="Select Existing User"
              onClick={() => setMethod("existing")}
            />
          </div>
        </div>

        {method === "email" ? (
          <label className="flex flex-col gap-2">
            <span className="text-xs font-black uppercase tracking-[0.14em] text-[var(--admin-on-surface-variant)]">
              Recipient
            </span>
            <input
              className="rounded-[14px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface)] px-4 py-3 text-sm font-semibold outline-none transition focus:border-[var(--admin-primary-container)]"
              name="email"
              placeholder="name@projectve.org"
              required
              type="email"
            />
          </label>
        ) : (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-black uppercase tracking-[0.14em] text-[var(--admin-on-surface-variant)]">
              Find a user
            </span>
            {selectedUser ? (
              <div className="flex items-center justify-between rounded-[14px] border border-[var(--admin-primary-container)] bg-[color:color-mix(in_srgb,var(--admin-primary-container)_10%,transparent)] px-4 py-3">
                <span className="text-sm font-bold text-[var(--admin-on-surface)]">{selectedUser.displayName}</span>
                <button
                  className="text-xs font-bold text-[var(--admin-on-surface-variant)] hover:underline"
                  onClick={() => {
                    setSelectedUser(null);
                    setQuery("");
                  }}
                  type="button"
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                <input
                  className="rounded-[14px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface)] px-4 py-3 text-sm font-semibold outline-none transition focus:border-[var(--admin-primary-container)]"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by name or referral code…"
                  type="search"
                  value={query}
                />
                {isSearching ? (
                  <p className="text-xs text-[var(--admin-on-surface-variant)]">Searching…</p>
                ) : null}
                {results.length > 0 ? (
                  <div className="flex flex-col overflow-hidden rounded-[14px] border border-[var(--admin-border-warm)]">
                    {results.map((candidate) => (
                      <button
                        className="border-b border-[var(--admin-border-warm)] px-4 py-2.5 text-left text-sm font-semibold text-[var(--admin-on-surface)] transition last:border-b-0 hover:bg-[var(--admin-surface-container-low)]"
                        key={candidate.id}
                        onClick={() => setSelectedUser(candidate)}
                        type="button"
                      >
                        {candidate.displayName}
                      </button>
                    ))}
                  </div>
                ) : null}
                {!isSearching && query.trim().length >= 2 && results.length === 0 ? (
                  <p className="text-xs text-[var(--admin-on-surface-variant)]">
                    No matching users who aren&rsquo;t already catalog staff.
                  </p>
                ) : null}
              </>
            )}
          </div>
        )}

        <section>
          <h3 className="text-xs font-black uppercase tracking-[0.14em] text-[var(--admin-on-surface-variant)]">
            Role Assignment
          </h3>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {ROLE_GRID.map((option) => (
              <button
                className={`rounded-[14px] border p-3 text-left text-xs font-bold transition ${
                  role === option
                    ? "border-[var(--admin-primary-container)] bg-[color:color-mix(in_srgb,var(--admin-primary-container)_12%,transparent)] text-[var(--admin-primary)]"
                    : "border-[var(--admin-border-warm)] text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-container-low)]"
                }`}
                key={option}
                onClick={() => setRole(option)}
                type="button"
              >
                {ORGANIZATION_ROLE_LABELS[option]}
              </button>
            ))}
          </div>
        </section>

        <label className="flex flex-col gap-2">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-[var(--admin-on-surface-variant)]">
            Invitation expires in (days)
          </span>
          <input
            className="rounded-[14px] border border-[var(--admin-border-warm)] bg-[var(--admin-surface)] px-4 py-3 text-sm font-semibold outline-none transition focus:border-[var(--admin-primary-container)]"
            defaultValue={14}
            max={90}
            min={1}
            name="expiresInDays"
            type="number"
          />
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
            className="rounded-full bg-[var(--admin-primary-container)] px-5 py-2 text-sm font-bold text-[var(--admin-on-primary)] transition hover:brightness-95 disabled:opacity-50"
            disabled={method === "existing" && !selectedUser}
            label="Send Invitation"
            pendingLabel="Sending…"
            type="submit"
          />
        </div>
      </form>
    </AdminDrawer>
  );
}
