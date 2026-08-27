export const DOCUMENT_FIELD_TYPES = [
  "text",
  "number",
  "date",
  "boolean",
  "single_select",
  "multi_select",
] as const;

export type DocumentFieldType = (typeof DOCUMENT_FIELD_TYPES)[number];

export function isEmptyFieldValue(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object" && value !== null && "value" in value) {
    return isEmptyFieldValue((value as { value: unknown }).value);
  }
  return false;
}

export function emptyFieldValue(_fieldType: DocumentFieldType): null {
  return null;
}

export function serializeFieldValue(fieldType: DocumentFieldType, value: unknown): unknown {
  if (isEmptyFieldValue(value)) return null;
  if (fieldType === "number") {
    const numeric = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
  if (fieldType === "boolean") return Boolean(value);
  if (fieldType === "multi_select") {
    return Array.isArray(value) ? value.map(String) : [String(value)];
  }
  if (fieldType === "date" || fieldType === "text" || fieldType === "single_select") {
    return String(value);
  }
  return value;
}

export function parseFieldValue(fieldType: DocumentFieldType, stored: unknown): unknown {
  if (isEmptyFieldValue(stored)) return null;
  if (fieldType === "number") {
    const numeric = typeof stored === "number" ? stored : Number(stored);
    return Number.isFinite(numeric) ? numeric : null;
  }
  if (fieldType === "boolean") return Boolean(stored);
  if (fieldType === "multi_select") {
    return Array.isArray(stored) ? stored.map(String) : [String(stored)];
  }
  return String(stored);
}

export function selectOptions(config: Record<string, unknown> | null | undefined): string[] {
  const raw = config?.options;
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => String(item));
}

export interface FieldValueSnapshot {
  id: string;
  fieldDefinitionId: string | null;
  localFieldKey: string | null;
  value: unknown;
  definitionKey?: string | null;
  definitionTypeId?: string | null;
}

function uniqueLocalKey(taken: Set<string>, key: string, rowId: string): string {
  if (!taken.has(key)) {
    taken.add(key);
    return key;
  }
  const fallback = `${key}__${rowId.replace(/-/g, "").slice(0, 8)}`;
  taken.add(fallback);
  return fallback;
}

export function retainFieldsOnTypeChange(
  values: FieldValueSnapshot[],
  nextTypeId: string | null,
  nextTypeFields: { id: string; key: string }[]
): FieldValueSnapshot[] {
  const nextByKey = new Map(nextTypeFields.map((field) => [field.key, field]));
  const nextIds = new Set(nextTypeFields.map((field) => field.id));
  const takenLocalKeys = new Set(
    values.map((row) => row.localFieldKey).filter((key): key is string => Boolean(key))
  );

  const detached = values.map((row) => {
    if (!row.fieldDefinitionId) return row;
    const staysTyped =
      nextTypeId != null &&
      (nextIds.has(row.fieldDefinitionId) || row.definitionTypeId === nextTypeId);
    if (staysTyped) return row;
    const key = row.definitionKey || row.fieldDefinitionId;
    return {
      ...row,
      fieldDefinitionId: null,
      localFieldKey: uniqueLocalKey(takenLocalKeys, key, row.id),
    };
  });

  return detached.map((row) => {
    if (row.fieldDefinitionId || !row.localFieldKey || nextTypeId == null) return row;
    const match = nextByKey.get(row.localFieldKey);
    if (!match) return row;
    const alreadyTyped = detached.some(
      (other) => other.id !== row.id && other.fieldDefinitionId === match.id
    );
    if (alreadyTyped) return row;
    return {
      ...row,
      fieldDefinitionId: match.id,
      localFieldKey: null,
    };
  });
}

export function fieldValuesWerePreserved(
  before: { id: string; value: unknown }[],
  after: { id: string; value: unknown }[]
): boolean {
  if (before.length !== after.length) return false;
  const afterById = new Map(after.map((row) => [row.id, row.value]));
  return before.every(
    (row) => afterById.has(row.id) && Object.is(afterById.get(row.id), row.value)
  );
}
