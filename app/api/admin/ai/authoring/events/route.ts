import { requireAdmin } from "@/lib/admin";
import { readAuthoringResult } from "@/features/ai-generation/authoring/reads";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { supabase } = await requireAdmin();
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return new Response("Select a result.", { status: 400 });
  try { await readAuthoringResult(supabase, id); }
  catch { return new Response("Result unavailable.", { status: 403 }); }
  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;
  const stream = new ReadableStream({
    start(controller) {
      const started = Date.now();
      let cursor = request.headers.get("last-event-id");
      const close = () => { if (!closed) { closed = true; clearTimeout(timer); controller.close(); } };
      request.signal.addEventListener("abort", close, { once: true });
      const tick = async () => {
        try {
          const result = await readAuthoringResult(supabase, id);
          if (closed) return;
          if (cursor !== result.updatedAt) {
            controller.enqueue(encoder.encode(`id: ${result.updatedAt}\ndata: ${JSON.stringify(result)}\n\n`));
            cursor = result.updatedAt;
          } else controller.enqueue(encoder.encode(": connected\n\n"));
          if (Date.now() - started > 45_000) { close(); return; }
          timer = setTimeout(tick, 2000);
        } catch {
          if (!closed) controller.enqueue(encoder.encode('event: unavailable\ndata: {}\n\n'));
          close();
        }
      };
      void tick();
    },
    cancel() { closed = true; clearTimeout(timer); },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "private, no-store", "X-Accel-Buffering": "no" } });
}
