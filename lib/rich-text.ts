import DOMPurify from "isomorphic-dompurify";

const ALLOWED_TAGS = ["p", "strong", "em", "a", "h2", "h3", "ul", "ol", "li", "br"];
const ALLOWED_ATTR = ["href", "target", "rel"];

export function sanitizeRichTextHtml(value: string, maxLength = 6000) {
  const input = value.slice(0, maxLength);

  return DOMPurify.sanitize(input, {
    ALLOWED_ATTR,
    ALLOWED_TAGS,
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed"],
  }).trim();
}

export function containsRichTextHtml(value: string) {
  return /<\/?(p|strong|em|a|h2|h3|ul|ol|li|br)\b/i.test(value);
}
