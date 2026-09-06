import { NextResponse } from "next/server";
import { mediaVersionId } from "@/features/media/domain/media-reference";
import { mediaRequestContext } from "@/features/media/server/context";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { isUnsatisfiableByteRange } from "@/features/media/domain/byte-range";
export const dynamic = "force-dynamic";
// The stable reference carries no capability. Authorise every request with the
// caller's session; signing is a storage operation AFTER the database decision.
export async function GET(request: Request, context: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await context.params;
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Vary": "Cookie", "Content-Security-Policy": "default-src 'none'; sandbox" };
  if (!mediaVersionId(`/api/media/${versionId}`)) return new NextResponse(null, { status: 404, headers });
  try {
    const { supabase, organizationId } = await mediaRequestContext();
    const { data, error } = await supabase.rpc("media_delivery", { p_version_id: versionId, p_organization_id: organizationId ?? undefined });
    const delivery = data as { bucket?: string; storagePath?: string; mimeType?: string } | null;
    if (error || !delivery?.bucket || !delivery.storagePath) return new NextResponse(null, { status: 404, headers });
    const { data: signed, error: signingError } = await createSupabaseAdminClient().storage.from(delivery.bucket).createSignedUrl(delivery.storagePath, 60);
    if (signingError || !signed?.signedUrl) return new NextResponse(null, { status: 503, headers });
    // Proxy the response rather than exposing a reusable capability to the browser.
    // Range requests preserve audio/video seeking. No private bytes enter Next's image cache.
    const range = request.headers.get("range");
    const upstream = await fetch(signed.signedUrl, { cache: "no-store", headers: range ? { Range: range } : undefined });
    // Some storage backends return an opaque 500 for an out-of-bounds range.
    // Confirm the actual object length only on that failure path; do not turn
    // unrelated storage outages into misleading 416 responses.
    if (range && upstream.status >= 500) {
      const metadata = await fetch(signed.signedUrl, { method: "HEAD", cache: "no-store" });
      const length = metadata.headers.get("content-length");
      if (metadata.ok && isUnsatisfiableByteRange(range, length)) {
        // Next may tee fetch bodies. Awaiting cancellation of one branch can
        // wait forever for the other; drain this small storage error instead.
        await upstream.arrayBuffer();
        return new NextResponse(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${length}` } });
      }
    }
    const responseHeaders = new Headers(headers);
    for (const name of ["content-type", "content-length", "content-range", "accept-ranges"]) {
      const value = upstream.headers.get(name); if (value) responseHeaders.set(name, value);
    }
    return new NextResponse(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch { return new NextResponse(null, { status: 503, headers }); }
}
