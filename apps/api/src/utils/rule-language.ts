/**
 * The words a rule may use (the engine's rule_language.json, BTC_DSL_V1). The engine knows how to
 * compute each variable; a rule that names anything else cannot be evaluated, so the API rejects it
 * when the rule is saved instead of when the engine runs.
 */
export const CONDITION_VARIABLES = [
  "open_dispute", "valid_rejection_event_count", "unauthorized_required_event_count", "required_event_completion_rate",
  "all_required_conditions_met", "approval_required", "valid_approval_count", "required_approval_quorum",
  "invoice_required", "late_penalty_applicable", "hold_on_open_dispute", "auto_release_allowed",
  "days_late_after_grace", "grace_period_days", "actual_completion_date", "due_date",
  "planned_payment_vnd_mn", "contract_value_vnd_mn", "payment_percent", "penalty_rate_pct_per_day", "max_penalty_pct",
] as const;
/** Only the payable formula may use the penalty it was given. */
export const PAYABLE_ONLY_VARIABLES = ["penalty_amount_vnd_mn"] as const;
const KEYWORDS = new Set(["AND", "TRUE", "FALSE", "MIN", "MAX"]);

/** Identifiers in a condition or formula that the engine does not know (empty when the text is fine). */
export function unknownWords(text: string, extra: readonly string[] = []): string[] {
  if (text.trim() === "ELSE") return [];
  const known = new Set<string>([...CONDITION_VARIABLES, ...extra]);
  const words = text.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [];
  return [...new Set(words.filter((w) => !KEYWORDS.has(w) && !known.has(w)))];
}
