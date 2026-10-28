import { describe, expect, it } from "vitest";
import { detectFileType, sanitizeFileName } from "@/lib/storage/file-types";

const bytes = (...values: number[]) => new Uint8Array(values);
const text = (value: string) => new TextEncoder().encode(value);

describe("upload type detection", () => {
  it("accepts files whose content matches their extension", () => {
    expect(detectFileType(text("%PDF-1.7\n..."), "cv.pdf")?.mime).toBe("application/pdf");
    expect(detectFileType(bytes(0x50, 0x4b, 0x03, 0x04, 0), "cv.docx")?.label).toBe("Word (DOCX)");
    expect(detectFileType(bytes(0xff, 0xd8, 0xff, 0xe0), "scan.JPG")?.mime).toBe("image/jpeg");
    expect(detectFileType(text("Plain notes"), "notes.md")?.mime).toBe("text/plain");
  });

  it("rejects mismatched content and disallowed extensions", () => {
    expect(detectFileType(text("<html>"), "cv.pdf")).toBeNull();
    expect(detectFileType(text("%PDF-1.7"), "cv.exe")).toBeNull();
    expect(detectFileType(bytes(0, 1, 2), "notes.txt")).toBeNull();
    expect(detectFileType(text("%PDF-"), "noextension")).toBeNull();
  });

  it("sanitises display names without trusting paths", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFileName("C:\\Users\\me\\cv.pdf")).toBe("cv.pdf");
    expect(sanitizeFileName("bad\u0000name.pdf")).toBe("badname.pdf");
    expect(sanitizeFileName("")).toBe("untitled");
    expect(sanitizeFileName("a".repeat(300)).length).toBe(200);
  });
});
