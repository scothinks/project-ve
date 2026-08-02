import { randomUUID } from "node:crypto";
import { sanitizePlainTextInput } from "./input-safety.ts";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const SAFE_CONTEXT_CHARS = /[^a-zA-Z0-9_-]/g;

export type ValidatedImageUpload = {
  extension: "jpg" | "png" | "webp";
  height: number | null;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  size: number;
  width: number | null;
};

type ValidateImageUploadInput = {
  bytes: Uint8Array;
  fileName?: string;
  mimeType?: string;
};

function extensionFromName(fileName: string | undefined) {
  const match = fileName?.toLowerCase().match(/\.([a-z0-9]+)$/);
  if (!match) return "";
  return match[1] === "jpeg" ? "jpg" : match[1];
}

function hasBytes(bytes: Uint8Array, offset: number, expected: number[]) {
  return expected.every((byte, index) => bytes[offset + index] === byte);
}

function readPngDimensions(bytes: Uint8Array) {
  if (bytes.length < 24) return { width: null, height: null };
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    width: view.getUint32(16, false),
    height: view.getUint32(20, false),
  };
}

function readJpegDimensions(bytes: Uint8Array) {
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) break;
    const marker = bytes[offset + 1];
    const length = (bytes[offset + 2] << 8) + bytes[offset + 3];
    if (length < 2) break;
    if (
      (marker >= 0xc0 && marker <= 0xc3)
      || (marker >= 0xc5 && marker <= 0xc7)
      || (marker >= 0xc9 && marker <= 0xcb)
      || (marker >= 0xcd && marker <= 0xcf)
    ) {
      return {
        height: (bytes[offset + 5] << 8) + bytes[offset + 6],
        width: (bytes[offset + 7] << 8) + bytes[offset + 8],
      };
    }
    offset += 2 + length;
  }

  return { width: null, height: null };
}

function readWebpDimensions(bytes: Uint8Array) {
  if (bytes.length < 30) return { width: null, height: null };
  const chunk = String.fromCharCode(...bytes.slice(12, 16));

  if (chunk === "VP8X" && bytes.length >= 30) {
    return {
      width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16),
      height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16),
    };
  }

  return { width: null, height: null };
}

export function validateImageUpload(input: ValidateImageUploadInput):
  | { ok: true; value: ValidatedImageUpload }
  | { ok: false; error: string } {
  const bytes = input.bytes;
  const size = bytes.byteLength;
  const extension = extensionFromName(input.fileName);
  const providedMimeType = input.mimeType?.toLowerCase().trim() ?? "";

  if (size === 0) {
    return { ok: false, error: "Choose a non-empty image file." };
  }

  if (size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "Image uploads must be 10 MB or smaller." };
  }

  let detected: ValidatedImageUpload | null = null;

  if (
    hasBytes(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    && (extension === "" || extension === "png")
  ) {
    detected = {
      extension: "png",
      mimeType: "image/png",
      size,
      ...readPngDimensions(bytes),
    };
  } else if (
    hasBytes(bytes, 0, [0xff, 0xd8, 0xff])
    && (extension === "" || extension === "jpg")
  ) {
    detected = {
      extension: "jpg",
      mimeType: "image/jpeg",
      size,
      ...readJpegDimensions(bytes),
    };
  } else if (
    bytes.length >= 16
    && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    && (extension === "" || extension === "webp")
  ) {
    detected = {
      extension: "webp",
      mimeType: "image/webp",
      size,
      ...readWebpDimensions(bytes),
    };
  }

  if (!detected) {
    return { ok: false, error: "Upload a PNG, JPEG, or WebP image." };
  }

  if (providedMimeType && providedMimeType !== detected.mimeType) {
    return { ok: false, error: "The file extension and MIME type do not match." };
  }

  return { ok: true, value: detected };
}

export function sanitizeUploadContext(value: string | null | undefined, fallback = "general") {
  const cleaned = sanitizePlainTextInput(String(value ?? ""), 120)
    .trim()
    .replace(SAFE_CONTEXT_CHARS, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return cleaned || fallback;
}

export function buildCmsStoragePath(input: {
  contextId?: string | null;
  extension: ValidatedImageUpload["extension"];
  now?: Date;
  uploadId?: string;
}) {
  const now = input.now ?? new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const context = sanitizeUploadContext(input.contextId);
  const uploadId = sanitizeUploadContext(input.uploadId ?? randomUUID().replaceAll("-", ""), "upload");

  return `cms/${context}/${year}/${month}/${uploadId}.${input.extension}`;
}

export { MAX_UPLOAD_BYTES };
