import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { sanitizePlainTextInput, sanitizeUrlInput } from "@/lib/input-safety";

type BuilderPageInput = {
  id?: string;
  title?: string;
  subtitle?: string | null;
  page_type?: string;
  page_number?: number;
  cover_image?: Record<string, unknown> | null;
};

type BuilderBlockInput = {
  id?: string;
  page_id?: string;
  block_type?: string;
  sort_order?: number;
  payload?: Record<string, unknown> | null;
  isDraft?: boolean;
};

type BuilderSaveBody = {
  lessonId?: string;
  pages?: BuilderPageInput[];
  blocks?: BuilderBlockInput[];
};

type SavedPageResult = {
  clientId: string;
  pageId: string;
  status: string;
};

type SavedBlockResult = {
  clientId: string;
  blockId: string;
  pageId: string;
  sortOrder: number;
  status: string;
};

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseInteger(value: unknown, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isDraftId(value: string) {
  return value.startsWith("draft-");
}

function sanitizePageImagePayload(input: unknown) {
  const payload = asRecord(input);
  const next: Record<string, unknown> = {};
  const src = sanitizeUrlInput(String(payload.src ?? ""), 1000);
  const alt = sanitizePlainTextInput(String(payload.alt ?? ""), 240);

  if (src) next.src = src;
  if (alt) next.alt = alt;

  if (payload.fit === "cover" || payload.fit === "contain") {
    next.fit = payload.fit;
  }

  const positionX = parseInteger(payload.positionX, 50);
  const positionY = parseInteger(payload.positionY, 50);
  next.positionX = Math.max(0, Math.min(100, positionX));
  next.positionY = Math.max(0, Math.min(100, positionY));

  const caption = sanitizePlainTextInput(String(payload.caption ?? ""), 500);
  if (caption) next.caption = caption;

  return next;
}

function sanitizeBlockPayload(blockType: string, input: unknown) {
  const payload = asRecord(input);

  if (blockType === "callout") {
    return {
      variant: sanitizePlainTextInput(String(payload.variant ?? "key_point"), 40),
      label: sanitizePlainTextInput(String(payload.label ?? ""), 80),
      title: sanitizePlainTextInput(String(payload.title ?? payload.heading ?? ""), 180),
      body: sanitizePlainTextInput(String(payload.body ?? ""), 2000),
    };
  }

  if (blockType === "image") {
    const next: Record<string, unknown> = {
      src: sanitizeUrlInput(String(payload.src ?? ""), 1000),
      alt: sanitizePlainTextInput(String(payload.alt ?? ""), 240),
      caption: sanitizePlainTextInput(String(payload.caption ?? ""), 500),
    };

    const aiManagedByAssetId = sanitizePlainTextInput(String(payload.aiManagedByAssetId ?? ""), 120);
    const aiManagedKind = sanitizePlainTextInput(String(payload.aiManagedKind ?? ""), 80);
    if (aiManagedByAssetId) next.aiManagedByAssetId = aiManagedByAssetId;
    if (aiManagedKind) next.aiManagedKind = aiManagedKind;
    if (payload.aiGenerated === true) next.aiGenerated = true;
    return next;
  }

  if (blockType === "video" || blockType === "audio") {
    return {
      src: sanitizeUrlInput(String(payload.src ?? ""), 1000),
      title: sanitizePlainTextInput(String(payload.title ?? payload.heading ?? ""), 180),
      caption: sanitizePlainTextInput(String(payload.caption ?? ""), 500),
      transcript: sanitizePlainTextInput(String(payload.transcript ?? payload.body ?? ""), 2000),
    };
  }

  if (blockType === "table") {
    const columns = Array.isArray(payload.columns)
      ? payload.columns.map((item) => sanitizePlainTextInput(String(item), 80)).filter(Boolean)
      : [];
    const rows = Array.isArray(payload.rows)
      ? payload.rows
          .map((row) => Array.isArray(row)
            ? row.map((cell) => sanitizePlainTextInput(String(cell), 160))
            : [])
          .filter((row) => row.some(Boolean))
      : [];

    return {
      title: sanitizePlainTextInput(String(payload.title ?? payload.heading ?? ""), 180),
      columns,
      rows,
      caption: sanitizePlainTextInput(String(payload.caption ?? ""), 500),
    };
  }

  return {
    heading: sanitizePlainTextInput(String(payload.heading ?? payload.title ?? ""), 180),
    body: sanitizePlainTextInput(String(payload.body ?? ""), 4000),
  };
}

export async function POST(request: Request) {
  const body = (await request.json()) as BuilderSaveBody;
  const lessonId = sanitizePlainTextInput(String(body.lessonId ?? ""), 120);

  if (!lessonId) {
    return NextResponse.json({ error: "lessonId is required." }, { status: 400 });
  }

  const pages = Array.isArray(body.pages) ? body.pages : [];
  const blocks = Array.isArray(body.blocks) ? body.blocks : [];
  const { supabase } = await requireAdmin();
  const savedPages: SavedPageResult[] = [];
  const savedBlocks: SavedBlockResult[] = [];
  const pageIdMap = new Map<string, string>();

  for (const page of [...pages].sort((a, b) => parseInteger(a.page_number, 0) - parseInteger(b.page_number, 0))) {
    const clientId = sanitizePlainTextInput(String(page.id ?? ""), 120);
    if (!clientId) {
      continue;
    }

    const { data, error } = await supabase.rpc("admin_upsert_lesson_page", {
      p_page_id: isDraftId(clientId) ? "" : clientId,
      p_lesson_id: lessonId,
      p_title: sanitizePlainTextInput(String(page.title ?? ""), 160),
      p_subtitle: sanitizePlainTextInput(String(page.subtitle ?? ""), 300),
      p_page_type: sanitizePlainTextInput(String(page.page_type ?? "concept"), 40) || "concept",
      p_page_number: parseInteger(page.page_number, 1),
      p_cover_image: sanitizePageImagePayload(page.cover_image),
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const result = (data ?? {}) as { pageId?: string; status?: string };
    const savedPageId = sanitizePlainTextInput(String(result.pageId ?? ""), 120);
    if (!savedPageId) {
      return NextResponse.json({ error: "The lesson page could not be saved." }, { status: 500 });
    }

    pageIdMap.set(clientId, savedPageId);
    savedPages.push({
      clientId,
      pageId: savedPageId,
      status: sanitizePlainTextInput(String(result.status ?? "saved"), 40) || "saved",
    });
  }

  for (const block of [...blocks].sort((a, b) => parseInteger(a.sort_order, 0) - parseInteger(b.sort_order, 0))) {
    const clientId = sanitizePlainTextInput(String(block.id ?? ""), 160);
    const rawPageId = sanitizePlainTextInput(String(block.page_id ?? ""), 120);
    const pageId = pageIdMap.get(rawPageId) ?? rawPageId;
    const blockType = sanitizePlainTextInput(String(block.block_type ?? "text"), 40) || "text";
    if (!pageId) {
      continue;
    }

    const blockId = block.isDraft || isDraftId(clientId) ? null : clientId || null;

    const { data, error } = await supabase.rpc("admin_upsert_lesson_block", {
      p_block_id: blockId,
      p_page_id: pageId,
      p_block_type: blockType,
      p_sort_order: parseInteger(block.sort_order, 1),
      p_payload: sanitizeBlockPayload(blockType, block.payload),
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const result = (data ?? {}) as { blockId?: string; status?: string };
    const savedBlockId = sanitizePlainTextInput(String(result.blockId ?? ""), 160);
    if (!savedBlockId) {
      return NextResponse.json({ error: "The lesson block could not be saved." }, { status: 500 });
    }

    const { data: savedBlockRow, error: savedBlockLookupError } = await supabase
      .from("lesson_content_blocks")
      .select("sort_order")
      .eq("id", savedBlockId)
      .maybeSingle<{ sort_order: number }>();

    if (savedBlockLookupError) {
      return NextResponse.json({ error: savedBlockLookupError.message }, { status: 500 });
    }

    savedBlocks.push({
      clientId,
      blockId: savedBlockId,
      pageId,
      sortOrder: savedBlockRow?.sort_order ?? parseInteger(block.sort_order, 1),
      status: sanitizePlainTextInput(String(result.status ?? "saved"), 40) || "saved",
    });
  }

  return NextResponse.json({
    status: "saved",
    notice: "Lesson content saved.",
    pages: savedPages,
    blocks: savedBlocks,
    savedAt: new Date().toISOString(),
  });
}
