// Intake field types we support in v1. Schema comment also lists "multi" (multi-select) but we
// skip that for now — single-select covers the common case and avoids the heavier multi-select UI.
export const FIELD_TYPES = ["short", "long", "email", "select", "checkbox"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  short: "Short text",
  long: "Long text",
  email: "Email",
  select: "Single choice",
  checkbox: "Checkbox",
};

export interface IntakeField {
  key: string;            // unique within a form; lowercase letters/digits/hyphens
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];     // for select
  conditionalOn?: { fieldKey: string; equals: string }; // show only if other field equals this value
}

// Decide whether a field is currently visible given the answers so far.
export function isFieldVisible(field: IntakeField, answers: Record<string, unknown>): boolean {
  if (!field.conditionalOn) return true;
  const answer = answers[field.conditionalOn.fieldKey];
  return String(answer ?? "") === field.conditionalOn.equals;
}
