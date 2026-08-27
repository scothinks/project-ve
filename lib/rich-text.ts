const ALLOWED_TAGS = new Set(["p", "strong", "em", "a", "h2", "h3", "ul", "ol", "li", "br"]);
const FORBIDDEN_CONTENT_TAGS = new Set(["script", "style", "iframe", "object", "embed"]);
const VOID_TAGS = new Set(["br"]);
const ALLOWED_TARGETS = new Set(["_blank", "_self", "_parent", "_top"]);
const ALLOWED_REL_TOKENS = new Set(["noopener", "noreferrer", "nofollow", "ugc", "sponsored"]);

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replaceAll("\"", "&quot;");
}

function isSafeHref(value: string) {
  const normalized = value.trim().replace(/[\u0000-\u001F\u007F\s]+/g, "");

  if (!normalized) {
    return false;
  }

  const colonIndex = normalized.indexOf(":");
  if (colonIndex >= 0 && normalized.slice(0, colonIndex).includes("&")) {
    return false;
  }

  const firstPathIndex = normalized.search(/[/?#]/);
  const hasProtocol = colonIndex >= 0 && (firstPathIndex === -1 || colonIndex < firstPathIndex);

  if (!hasProtocol) {
    return true;
  }

  const protocol = normalized.slice(0, colonIndex).toLowerCase();
  return protocol === "http" || protocol === "https" || protocol === "mailto" || protocol === "tel";
}

function sanitizeAnchorAttributes(rawAttributes: string) {
  const attributes: string[] = [];
  const attributePattern = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match: RegExpExecArray | null;

  while ((match = attributePattern.exec(rawAttributes)) !== null) {
    const name = match[1].toLowerCase();
    const value = match[2] ?? match[3] ?? match[4] ?? "";

    if (name === "href" && isSafeHref(value)) {
      attributes.push(`href="${escapeAttribute(value.trim())}"`);
    }

    if (name === "target" && ALLOWED_TARGETS.has(value)) {
      attributes.push(`target="${value}"`);
    }

    if (name === "rel") {
      const rel = value
        .split(/\s+/)
        .map((token) => token.toLowerCase())
        .filter((token) => ALLOWED_REL_TOKENS.has(token))
        .join(" ");
      if (rel) {
        attributes.push(`rel="${rel}"`);
      }
    }
  }

  return attributes.length > 0 ? ` ${attributes.join(" ")}` : "";
}

export function sanitizeRichTextHtml(value: string, maxLength = 6000) {
  const input = value.slice(0, maxLength);
  const output: string[] = [];
  const openTags: string[] = [];
  const tokenPattern = /<!--[\s\S]*?-->|<\/?([a-zA-Z][\w:-]*)([^>]*)>/g;
  let cursor = 0;
  let forbiddenDepth = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(input)) !== null) {
    if (forbiddenDepth === 0) {
      output.push(escapeHtml(input.slice(cursor, match.index)));
    }

    cursor = tokenPattern.lastIndex;

    if (match[0].startsWith("<!--")) {
      continue;
    }

    const tagName = match[1].toLowerCase();
    const rawAttributes = match[2] ?? "";
    const isClosingTag = match[0].startsWith("</");
    const isSelfClosing = /\/\s*>$/.test(match[0]);

    if (FORBIDDEN_CONTENT_TAGS.has(tagName)) {
      if (isClosingTag) {
        forbiddenDepth = Math.max(0, forbiddenDepth - 1);
      } else if (!isSelfClosing) {
        forbiddenDepth += 1;
      }
      continue;
    }

    if (forbiddenDepth > 0 || !ALLOWED_TAGS.has(tagName)) {
      continue;
    }

    if (isClosingTag) {
      const openTagIndex = openTags.lastIndexOf(tagName);
      if (openTagIndex === -1) {
        continue;
      }

      for (let index = openTags.length - 1; index >= openTagIndex; index -= 1) {
        output.push(`</${openTags.pop()}>`);
      }
      continue;
    }

    if (VOID_TAGS.has(tagName)) {
      output.push("<br>");
      continue;
    }

    const attributes = tagName === "a" ? sanitizeAnchorAttributes(rawAttributes) : "";
    output.push(`<${tagName}${attributes}>`);
    openTags.push(tagName);
  }

  if (forbiddenDepth === 0) {
    output.push(escapeHtml(input.slice(cursor)));
  }

  while (openTags.length > 0) {
    output.push(`</${openTags.pop()}>`);
  }

  return output.join("").trim();
}

export function containsRichTextHtml(value: string) {
  return /<\/?(p|strong|em|a|h2|h3|ul|ol|li|br)\b/i.test(value);
}
