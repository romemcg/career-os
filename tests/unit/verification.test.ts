import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/http/errors";
import { allowedActions, nextVerificationStatus, statusAfterEdit } from "@/modules/career/verification";

describe("verification state machine", () => {
  it("verifies an unverified fact only when it has a source", () => {
    expect(nextVerificationStatus("unverified", "verify", { hasSource: true })).toBe("verified");
    expect(() => nextVerificationStatus("unverified", "verify", { hasSource: false })).toThrow(/source/);
  });

  it("rejects and reopens", () => {
    expect(nextVerificationStatus("unverified", "reject", { hasSource: false })).toBe("rejected");
    expect(nextVerificationStatus("rejected", "reopen", { hasSource: false })).toBe("unverified");
    expect(nextVerificationStatus("verified", "reopen", { hasSource: true })).toBe("unverified");
  });

  it("refuses invalid transitions with INVALID_TRANSITION", () => {
    for (const [from, action] of [
      ["verified", "verify"],
      ["verified", "reject"],
      ["rejected", "verify"],
      ["superseded", "reopen"],
      ["unverified", "reopen"],
    ] as const) {
      try {
        nextVerificationStatus(from, action, { hasSource: true });
        expect.fail(`${from} -> ${action} should fail`);
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe("INVALID_TRANSITION");
      }
    }
  });

  it("treats superseded as terminal", () => {
    expect(allowedActions("superseded")).toEqual([]);
    expect(() => statusAfterEdit("superseded", true, false)).toThrow(/read-only/);
  });

  it("withdraws verification when a verified fact's content or source changes", () => {
    expect(statusAfterEdit("verified", true, false)).toBe("unverified");
    expect(statusAfterEdit("verified", false, true)).toBe("unverified");
    expect(statusAfterEdit("unverified", true, true)).toBe("unverified");
    expect(statusAfterEdit("rejected", true, false)).toBe("rejected");
  });
});
