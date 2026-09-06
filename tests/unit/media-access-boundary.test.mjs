import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { mediaUrl, mediaVersionId } from "../../features/media/domain/media-reference.ts";
import { sanitizeUrlInput } from "../../lib/input-safety.ts";
const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
test("managed references survive URL sanitization without allowing arbitrary relative URLs", () => {
  const id = "90500000-0000-4000-8000-000000000301";
  assert.equal(mediaVersionId(mediaUrl(id)), id);
  assert.equal(sanitizeUrlInput(mediaUrl(id)), mediaUrl(id));
  for (const value of ["/api/media/invalid", "/api/media/../../admin", "//other.test/image", "/api/media/" + id + "?bucket=other", "javascript:alert(1)"]) {
    assert.equal(mediaVersionId(value), null);
    assert.equal(sanitizeUrlInput(value), "");
  }
});
test("media signing follows caller authorization and private responses bypass shared caching", () => {
  const route = read("app/api/media/[versionId]/route.ts");
  assert.ok(route.indexOf('.rpc("media_delivery"') < route.indexOf("createSupabaseAdminClient().storage"));
  assert.match(route, /if \(error \|\| !delivery\?\.bucket \|\| !delivery.storagePath\)/);
  assert.match(route, /private, no-store/);
  assert.match(route, /Range: range/);
  assert.doesNotMatch(route, /NextResponse.redirect/);
  assert.match(read("components/media/MediaImage.tsx"), /unoptimized=\{managed \|\| props.unoptimized\}/);
});
test("library reads are explicit paginated requests and uploads never overwrite shared storage", () => {
  const library = read("components/admin/MediaLibrary.tsx");
  assert.match(library, /AbortController/);
  assert.match(library, /offset/);
  assert.doesNotMatch(library, /service.role|createSupabaseAdminClient/);
  for (const path of ["features/media/server/upload.ts", "lib/ai-media-generator.ts"]) {
    assert.match(read(path), /upsert: false/);
    assert.doesNotMatch(read(path), /getPublicUrl/);
  }
});
