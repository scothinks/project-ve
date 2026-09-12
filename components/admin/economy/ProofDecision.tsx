"use client";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { reviewProofSubmission } from "@/app/admin/proofs/actions";
import { adminButtonClasses } from "@/components/admin/AdminPrimitives";
function DecisionButton({ decline }: { decline: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      className={adminButtonClasses(decline ? "danger" : "primary")}
      disabled={pending}
      type="submit"
    >
      {pending
        ? "Saving decision…"
        : decline
          ? "Send reason & decline"
          : "Approve proof"}
    </button>
  );
}
export function ProofDecision({
  userId,
  missionId,
  awardScope,
  returnPage = 1,
  returnStatus = "submitted",
}: {
  userId: string;
  missionId: string;
  awardScope: string;
  returnPage?: number;
  returnStatus?: string;
}) {
  const [decline, setDecline] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <form
      action={reviewProofSubmission}
      className="mt-5 space-y-3 border-t border-[var(--ui-border-subtle)] pt-5"
    >
      <input name="userId" type="hidden" value={userId} />
      <input name="missionId" type="hidden" value={missionId} />
      <input name="awardScope" type="hidden" value={awardScope} />
      <input name="returnPage" type="hidden" value={returnPage} />
      <input name="returnStatus" type="hidden" value={returnStatus} />
      <input
        name="status"
        type="hidden"
        value={decline ? "rejected" : "approved"}
      />
      {decline ? (
        <>
          <label className="block text-sm font-semibold">
            Reason to send to the learner
            <textarea
              autoFocus
              className="mt-2 block min-h-24 w-full rounded-xl border border-[var(--ui-control-border)] bg-[var(--ui-surface)] p-3"
              maxLength={500}
              name="rejectionReason"
              onChange={(event) => setReason(event.target.value)}
              required
              value={reason}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              "Please include all the required evidence.",
              "The image is unclear. Please upload a clearer version.",
              "This evidence does not show the completed task.",
            ].map((text) => (
              <button
                className="rounded-lg bg-[var(--ui-surface-inset)] px-3 py-2 text-xs"
                key={text}
                onClick={() => setReason(text)}
                type="button"
              >
                {text}
              </button>
            ))}
          </div>
        </>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <DecisionButton decline={decline} />
        <button
          className={adminButtonClasses("secondary")}
          onClick={() => setDecline(!decline)}
          type="button"
        >
          {decline ? "Cancel" : "Decline with a reason"}
        </button>
      </div>
    </form>
  );
}
