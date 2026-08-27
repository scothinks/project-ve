"use client";

import LinkExtension from "@tiptap/extension-link";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type RichTextBlockEditorProps = {
  disabled?: boolean;
  onChange: (value: string) => void;
  value: string;
};

function toolbarButtonClasses(active = false) {
  return cn(
    "inline-flex min-h-9 items-center justify-center rounded-[10px] border px-3 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50",
    active
      ? "border-[var(--ve-green)] bg-[color:color-mix(in_srgb,var(--ve-green-soft)_80%,var(--ve-card))] text-[var(--ve-green)]"
      : "border-[var(--ve-line-soft)] bg-[var(--ve-card)] text-[var(--ve-muted-strong)] hover:text-[var(--ve-green)]",
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
          "min-h-44 rounded-[12px] border border-[var(--ve-line)] bg-[var(--ve-card)] px-4 py-3 text-sm font-semibold leading-7 outline-none focus:border-[var(--ve-green)] focus:ring-4 focus:ring-[color:color-mix(in_srgb,var(--ve-green)_10%,transparent)]",
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
    editor?.setEditable(!disabled);
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
    <div className="mt-2 rounded-[14px] border border-[var(--ve-line-soft)] bg-[var(--ve-panel)] p-2">
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
          className="min-h-9 rounded-[10px] border border-[var(--ve-line-soft)] bg-[var(--ve-card)] px-3 text-xs font-bold outline-none focus:border-[var(--ve-green)]"
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
      <EditorContent editor={editor} />
    </div>
  );
}
