"use client";

import { getPaginationWindow } from "@/lib/pagination";
import { cn } from "@/lib/utils";

type PaginationControlsProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
};

export function PaginationControls({
  currentPage,
  totalPages,
  onPageChange,
  className,
}: PaginationControlsProps) {
  if (totalPages <= 1) {
    return null;
  }

  const pageWindow = getPaginationWindow(currentPage, totalPages);

  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-2", className)}>
      <button
        className="h-10 rounded-[14px] border border-[var(--ve-line)] px-4 text-xs font-black text-[var(--ve-muted-strong)] disabled:opacity-40"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
        type="button"
      >
        Prev
      </button>
      {pageWindow[0] && pageWindow[0] > 1 ? (
        <>
          <button
            className="grid size-10 place-items-center rounded-[14px] border border-[var(--ve-line)] text-xs font-black text-[var(--ve-muted-strong)]"
            onClick={() => onPageChange(1)}
            type="button"
          >
            1
          </button>
          {pageWindow[0] > 2 ? <span className="px-1 text-xs font-black text-[var(--ve-muted)]">…</span> : null}
        </>
      ) : null}
      {pageWindow.map((page) => (
        <button
          className={cn(
            "grid size-10 place-items-center rounded-[14px] border text-xs font-black",
            page === currentPage
              ? "border-[var(--ve-green)] bg-[var(--ve-green-soft)] text-[var(--ve-green)]"
              : "border-[var(--ve-line)] text-[var(--ve-muted-strong)]",
          )}
          key={page}
          onClick={() => onPageChange(page)}
          type="button"
        >
          {page}
        </button>
      ))}
      {pageWindow[pageWindow.length - 1] && pageWindow[pageWindow.length - 1] < totalPages ? (
        <>
          {pageWindow[pageWindow.length - 1] < totalPages - 1 ? (
            <span className="px-1 text-xs font-black text-[var(--ve-muted)]">…</span>
          ) : null}
          <button
            className="grid size-10 place-items-center rounded-[14px] border border-[var(--ve-line)] text-xs font-black text-[var(--ve-muted-strong)]"
            onClick={() => onPageChange(totalPages)}
            type="button"
          >
            {totalPages}
          </button>
        </>
      ) : null}
      <button
        className="h-10 rounded-[14px] border border-[var(--ve-line)] px-4 text-xs font-black text-[var(--ve-muted-strong)] disabled:opacity-40"
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        type="button"
      >
        Next
      </button>
    </div>
  );
}
