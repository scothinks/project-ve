'use client';
import { useEffect, useState } from 'react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { useRouter } from 'next/navigation';
import { aiButton, aiPrimary } from './AiPageResult';

export function CourseLeaveGuard({ dirty }: { dirty: boolean }) {
  const [destination, setDestination] = useState<string | null>(null);
  const router = useRouter();
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element).closest?.('a[href]') as HTMLAnchorElement | null;
      if (!link || link.target === '_blank' || link.hasAttribute('download') || link.href === location.href || link.getAttribute('href')?.startsWith('#')) return;
      event.preventDefault(); event.stopPropagation(); setDestination(link.href);
    };
    window.addEventListener('beforeunload', unload); document.addEventListener('click', click, true);
    return () => { window.removeEventListener('beforeunload', unload); document.removeEventListener('click', click, true); };
  }, [dirty]);
  return <AlertDialog.Root open={!!destination} onOpenChange={open => { if (!open) setDestination(null); }}><AlertDialog.Portal>
    <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/30" />
    <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-[var(--admin-surface-milk)] p-6 shadow-xl">
      <AlertDialog.Title className="text-lg font-bold">Leave unsaved changes?</AlertDialog.Title>
      <AlertDialog.Description className="mt-3 text-sm leading-6">Your latest brief or outline edits have not been saved. Generated results remain in AI results.</AlertDialog.Description>
      <div className="mt-5 flex flex-wrap gap-3"><AlertDialog.Cancel className={aiButton}>Keep editing</AlertDialog.Cancel><AlertDialog.Action className={aiPrimary} onClick={() => { const url = destination; setDestination(null); if (url) router.push(url); }}>Leave without saving</AlertDialog.Action></div>
    </AlertDialog.Content>
  </AlertDialog.Portal></AlertDialog.Root>;
}
