// Upload allowlist. The declared MIME type must agree with the file's magic bytes.

export type AllowedType = { mime: string; extensions: string[]; label: string };

export const ALLOWED_TYPES: AllowedType[] = [
  { mime: "application/pdf", extensions: [".pdf"], label: "PDF" },
  {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    extensions: [".docx"],
    label: "Word (DOCX)",
  },
  { mime: "text/plain", extensions: [".txt", ".md"], label: "Text" },
  { mime: "image/png", extensions: [".png"], label: "PNG" },
  { mime: "image/jpeg", extensions: [".jpg", ".jpeg"], label: "JPEG" },
];

const startsWith = (bytes: Uint8Array, signature: number[]) =>
  bytes.length >= signature.length && signature.every((byte, i) => bytes[i] === byte);

function looksLikeText(bytes: Uint8Array): boolean {
  if (bytes.includes(0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

/** Detect the file type from content and extension; returns null if not allowed. */
export function detectFileType(bytes: Uint8Array, fileName: string): AllowedType | null {
  const ext = fileName.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? "";
  const byExt = ALLOWED_TYPES.find((type) => type.extensions.includes(ext));
  if (!byExt) return null;
  switch (byExt.mime) {
    case "application/pdf":
      return startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]) ? byExt : null; // %PDF-
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) ? byExt : null; // ZIP container
    case "image/png":
      return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) ? byExt : null;
    case "image/jpeg":
      return startsWith(bytes, [0xff, 0xd8, 0xff]) ? byExt : null;
    case "text/plain":
      return looksLikeText(bytes) ? byExt : null;
    default:
      return null;
  }
}

/** Keep a display-safe version of the original filename. Never used in paths. */
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return (cleaned || "untitled").slice(0, 200);
}
