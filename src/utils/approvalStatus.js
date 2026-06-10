/**
 * Single source of truth for a quotation's approval decision.
 *
 * Public approvals are recorded in Supabase `tracked_quotes` (token-based, with
 * signer name + timestamp). The Email tab and Dashboard read rows from the
 * Google Sheet. This helper reconciles the two: a real tracked decision
 * (approved / declined / negotiate) always wins; otherwise we fall back to the
 * sheet's Approval / Decline / Negotiate columns (the legacy email-CTA path).
 */

/** The three sheet status columns and the cell word each decision writes. */
export const STATUS_CELL = {
  approved: { col: "Approval", word: "Approved" },
  declined: { col: "Decline", word: "Declined" },
  negotiate: { col: "Negotiate", word: "Negotiate" },
};

const DECISIONS = ["approved", "declined", "negotiate"];

/**
 * Resolve a row's effective decision.
 * @returns {"approved"|"declined"|"negotiate"|"pending"}
 */
export function resolveDecision({ sheetApproval, sheetDecline, sheetNegotiate, trackedStatus }) {
  if (DECISIONS.includes(trackedStatus)) return trackedStatus;
  if (String(sheetApproval ?? "").trim()) return "approved";
  if (String(sheetDecline ?? "").trim()) return "declined";
  if (String(sheetNegotiate ?? "").trim()) return "negotiate";
  return "pending";
}
