import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";

type DeleteBlockBody = {
  pageId?: string;
  blockId?: string;
};

export async function DELETE(request: Request) {
  const body = (await request.json()) as DeleteBlockBody;

  if (!body.pageId || !body.blockId) {
    return NextResponse.json({ error: "pageId and blockId are required." }, { status: 400 });
  }

  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("admin_delete_lesson_block", {
    p_page_id: body.pageId,
    p_block_id: body.blockId,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: "deleted" });
}
