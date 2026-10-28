import type { VerificationStatus } from "@/generated/prisma/enums";
import { AppError } from "@/lib/http/errors";

export type VerificationAction = "verify" | "reject" | "reopen";

/**
 * Verification state machine (pure, no I/O).
 *
 *   unverified --verify--> verified        (requires a source)
 *   unverified --reject--> rejected        (requires a reason)
 *   verified   --reopen--> unverified      (withdraw a verification)
 *   rejected   --reopen--> unverified
 *   verified   ---------> superseded      (only when a replacement fact is verified)
 *
 * Superseded is terminal. Editing a verified fact's content returns it to unverified.
 */
const transitions: Record<VerificationStatus, Partial<Record<VerificationAction, VerificationStatus>>> = {
  unverified: { verify: "verified", reject: "rejected" },
  verified: { reopen: "unverified" },
  rejected: { reopen: "unverified" },
  superseded: {},
};

export function nextVerificationStatus(
  current: VerificationStatus,
  action: VerificationAction,
  context: { hasSource: boolean },
): VerificationStatus {
  const next = transitions[current][action];
  if (!next) {
    throw new AppError("INVALID_TRANSITION", `Cannot ${action} a fact that is ${current}`);
  }
  if (next === "verified" && !context.hasSource) {
    throw new AppError("INVALID_TRANSITION", "Attach a source before verifying this fact");
  }
  return next;
}

export function allowedActions(current: VerificationStatus): VerificationAction[] {
  return Object.keys(transitions[current]) as VerificationAction[];
}

/** Status after an edit: content changes invalidate a prior verification. */
export function statusAfterEdit(current: VerificationStatus, contentChanged: boolean, sourceChanged: boolean) {
  if (current === "superseded") {
    throw new AppError("INVALID_TRANSITION", "Superseded facts are read-only");
  }
  if (current === "verified" && (contentChanged || sourceChanged)) return "unverified";
  return current;
}
