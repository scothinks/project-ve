import assert from "node:assert/strict";
import test from "node:test";
import {
  getContinuityInstruction,
  getImagePayloadString,
  getRedirectTarget,
  parseBooleanFlag,
  parseImagePresentationInput,
  parseRequiredChangeRequest,
} from "../../features/ai-generation/application/form-input.ts";

function formData(entries = []) {
  const form = new FormData();
  for (const [key, value] of entries) {
    form.set(key, value);
  }
  return form;
}

test("form input helpers sanitize redirect and required change text", () => {
  assert.equal(
    getRedirectTarget(formData([["redirectTo", "/admin/courses/<bad>"]]), "/fallback"),
    "/admin/courses/bad",
  );
  assert.equal(getRedirectTarget(formData([["redirectTo", ""]]), "/fallback"), "/fallback");
  assert.equal(
    parseRequiredChangeRequest(formData([["changeRequest", " Make this clearer <> "]]), "changeRequest"),
    "Make this clearer",
  );
  assert.throws(
    () => parseRequiredChangeRequest(formData([["changeRequest", "   "]]), "changeRequest"),
    /Add the specific changes/,
  );
});

test("boolean and continuity helpers normalize common form values", () => {
  for (const value of ["1", "true", "on", "yes", " TRUE "]) {
    assert.equal(parseBooleanFlag(value), true);
  }
  for (const value of ["0", "false", "off", "", null]) {
    assert.equal(parseBooleanFlag(value), false);
  }
  assert.equal(
    getContinuityInstruction(formData([["continuityInstruction", " Keep tone simple <> "]])),
    " Keep tone simple  ",
  );
});

test("image presentation and payload string helpers normalize image input", () => {
  const presentation = parseImagePresentationInput(formData([
    ["imageFit", "contain"],
    ["imagePositionX", "125"],
    ["imagePositionY", "-10"],
  ]));

  assert.deepEqual(presentation, {
    fit: "contain",
    positionX: 100,
    positionY: 0,
  });
  assert.equal(
    getImagePayloadString({ src: " https://example.com/image.png ", alt: 42 }, "src"),
    "https://example.com/image.png",
  );
  assert.equal(getImagePayloadString({ alt: 42 }, "alt"), "");
});
