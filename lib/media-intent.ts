export type MediaIntent = {
  version: 1;
  kind: "image" | "video" | "audio";
  purpose: string;
  aspectRatio: "16:9" | "4:3" | "1:1";
  required: boolean;
  style: "inherit";
};

export function mediaIntent(payload: Record<string, unknown>): MediaIntent | null {
  const value = payload.mediaIntent as Partial<MediaIntent> | undefined;
  return value?.version === 1 && ["image", "video", "audio"].includes(value.kind ?? "")
    && typeof value.purpose === "string" && Boolean(value.purpose.trim())
    && typeof value.required === "boolean" && value.style === "inherit"
    && ["16:9", "4:3", "1:1"].includes(value.aspectRatio ?? "") ? value as MediaIntent : null;
}

export function isEmptyMediaPlaceholder(block: { block_type: string; payload: Record<string, unknown> }) {
  const intent = mediaIntent(block.payload);
  return intent?.kind === block.block_type && !String(block.payload.src ?? "").trim();
}

export function normalizeMediaPlaceholder(kind: string, payload: Record<string, unknown>) {
  const intent = mediaIntent(payload);
  if (!intent || intent.kind !== kind || intent.required || intent.purpose.length > 1000
    || Object.keys(intent).some(key => !["version", "kind", "purpose", "aspectRatio", "required", "style"].includes(key))
    || Object.keys(payload).some(key => key !== "mediaIntent" && key !== "src") || payload.src) {
    throw new Error("Generated media must be an optional placeholder without an asset or URL.");
  }
  return { src: "", mediaIntent: { ...intent, purpose: intent.purpose.trim() } };
}

export const MEDIA_PLACEHOLDER_SCHEMA = {
  type: "object", additionalProperties: false, required: ["blockType", "payload"],
  properties: {
    blockType: { type: "string", enum: ["image", "video", "audio"] },
    payload: { type: "object", additionalProperties: false, required: ["mediaIntent"], properties: {
      mediaIntent: { type: "object", additionalProperties: false,
        required: ["version", "kind", "purpose", "aspectRatio", "required", "style"], properties: {
          version: { type: "integer", enum: [1] }, kind: { type: "string", enum: ["image", "video", "audio"] },
          purpose: { type: "string" }, aspectRatio: { type: "string", enum: ["16:9", "4:3", "1:1"] },
          required: { type: "boolean", enum: [false] }, style: { type: "string", enum: ["inherit"] },
        } },
    } },
  },
} as const;
