// Keep the deferred editor's toolbar and content footprint before its bundle
// loads. A short placeholder otherwise moves the following media controls.
export const richTextFrameClass = 'mt-2 rounded-[14px] border border-[var(--ui-border-subtle)] bg-[var(--ui-surface-soft)] p-2';
export const richTextButtonBase = 'inline-flex min-h-9 items-center justify-center rounded-[10px] border px-3 text-xs font-black';

export function RichTextEditorLoading() {
  return <div className={richTextFrameClass}>
    <div aria-hidden="true" className="mb-2 flex flex-wrap gap-2">
      {['B', 'I', 'H2', 'Bullets', 'Numbers'].map(label => <span key={label} className={richTextButtonBase}>{label}</span>)}
    </div>
    <div aria-hidden="true" className="mb-2 grid gap-2 md:grid-cols-[1fr_auto]">
      <div className="min-h-9 rounded-[10px] border px-3 text-xs font-bold" />
      <span className={richTextButtonBase}>Link</span>
    </div>
    <div role="status" className="min-h-44 rounded-[12px] border px-4 py-3 text-sm font-semibold leading-7">Loading editor...</div>
  </div>;
}
