import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";

type ReorderBody =
  | {
      kind: "page";
      lessonId: string;
      pageId: string;
      direction: "up" | "down";
    }
  | {
      kind: "block";
      pageId: string;
      blockId: string;
      direction: "up" | "down";
    };

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<ReorderBody>;
  const { supabase } = await requireAdmin();

  if (body.kind === "page") {
    if (!body.lessonId || !body.pageId) {
      return NextResponse.json({ error: "lessonId and pageId are required." }, { status: 400 });
    }

    const { error } = await supabase.rpc("admin_reorder_lesson_page", {
      p_lesson_id: body.lessonId,
      p_page_id: body.pageId,
      p_direction: body.direction === "up" ? "up" : "down",
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ status: "updated" });
  }

  if (body.kind === "block") {
    if (!body.pageId || !body.blockId) {
      return NextResponse.json({ error: "pageId and blockId are required." }, { status: 400 });
    }

    const { error } = await supabase.rpc("admin_reorder_lesson_block", {
      p_page_id: body.pageId,
      p_block_id: body.blockId,
      p_direction: body.direction === "up" ? "up" : "down",
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ status: "updated" });
  }

  return NextResponse.json({ error: "Unsupported reorder request." }, { status: 400 });
}
