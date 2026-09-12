"use client";

import LinkExtension from "@tiptap/extension-link";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { richTextButtonBase, richTextFrameClass } from './RichTextEditorLoading';

export type RichTextBlockEditorProps = {
  disabled?: boolean;
  onChange: (value: string) => void;
  value: string;
};

function toolbarButtonClasses(active = false) {
  return cn(
    richTextButtonBase,
    "transition disabled:cursor-not-allowed disabled:opacity-50",
    active
      ? "border-[var(--ui-action)] bg-[color:color-mix(in_srgb,var(--ui-action-soft)_80%,var(--ui-surface))] text-[var(--ui-action)]"
      : "border-[var(--ui-border-subtle)] bg-[var(--ui-surface)] text-[var(--ui-text-muted)] hover:text-[var(--ui-action)]",
  );
}

export function RichTextBlockEditor({
  disabled = false,
  onChange,
  value,
}: RichTextBlockEditorProps) {
  const [linkHref, setLinkHref] = useState("");
  const editor = useEditor({
    content: value || "<p></p>",
    editorProps: {
      attributes: {
        class:
          "min-h-44 rounded-[12px] border border-[var(--ui-control-border)] bg-[var(--ui-surface)] px-4 py-3 text-sm font-semibold leading-7 outline-none focus:border-[var(--ui-focus)] focus:ring-4 focus:ring-[var(--ui-focus)]",
      },
    },
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
      LinkExtension.configure({
        autolink: true,
        defaultProtocol: "https",
        openOnClick: false,
        protocols: ["http", "https", "mailto", "tel"],
      }),
    ],
    immediatelyRender: false,
    onUpdate({ editor: nextEditor }) {
      onChange(nextEditor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor || editor.getHTML() === value) {
      return;
    }

    editor.commands.setContent(value || "<p></p>", { emitUpdate: false });
  }, [editor, value]);

  useEffect(() => {
    // Changing editor availability must not turn normalized HTML into an edit.
    editor?.setEditable(!disabled, false);
  }, [disabled, editor]);

  function applyLink() {
    if (!editor) return;
    const trimmedHref = linkHref.trim();

    if (!trimmedHref) {
      editor.chain().focus().unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: trimmedHref }).run();
  }

  return (
    <div className={richTextFrameClass}>
      <div className="mb-2 flex flex-wrap gap-2">
        <button
          className={toolbarButtonClasses(editor?.isActive("bold") ?? false)}
          disabled={disabled || !editor}
          onClick={() => editor?.chain().focus().toggleBold().run()}
          type="button"
        >
          B
        </button>
        <button
          className={toolbarButtonClasses(editor?.isActive("italic") ?? false)}
          disabled={disabled || !editor}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          type="button"
        >
          I
        </button>
        <button
          className={toolbarButtonClasses(editor?.isActive("heading", { level: 2 }) ?? false)}
          disabled={disabled || !editor}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          type="button"
        >
          H2
        </button>
        <button
          className={toolbarButtonClasses(editor?.isActive("bulletList") ?? false)}
          disabled={disabled || !editor}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          type="button"
        >
          Bullets
        </button>
        <button
          className={toolbarButtonClasses(editor?.isActive("orderedList") ?? false)}
          disabled={disabled || !editor}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          type="button"
        >
          Numbers
        </button>
      </div>
      <div className="mb-2 grid gap-2 md:grid-cols-[1fr_auto]">
        <input
          className="min-h-9 rounded-[10px] border border-[var(--ui-control-border)] bg-[var(--ui-surface)] px-3 text-xs font-bold outline-none focus:border-[var(--ui-focus)]"
          disabled={disabled || !editor}
          onChange={(event) => setLinkHref(event.target.value)}
          placeholder="https://example.com"
          value={linkHref}
        />
        <button
          className={toolbarButtonClasses(editor?.isActive("link") ?? false)}
          disabled={disabled || !editor}
          onClick={applyLink}
          type="button"
        >
          Link
        </button>
      </div>
      {/* Reserve the editor's minimum height before Tiptap mounts so nearby
          controls do not move between pointer down and pointer up. */}
      <EditorContent className="min-h-44" editor={editor} />
    </div>
  );
}
