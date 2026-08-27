"use client";

import { parseFieldValue, selectOptions } from "@/lib/documents/fields";
import type { DocumentFieldValue, DocumentType, FieldDefinition } from "@/lib/documents/types";

interface DocumentPropertiesProps {
  types: DocumentType[];
  typeId: string | null;
  fields: FieldDefinition[];
  values: DocumentFieldValue[];
  onTypeChange: (typeId: string | null) => void;
  onFieldChange: (field: FieldDefinition, value: unknown) => void;
}

function valueFor(field: FieldDefinition, values: DocumentFieldValue[]): unknown {
  const row = values.find((item) => item.fieldDefinitionId === field.id);
  return parseFieldValue(field.fieldType, row?.value ?? null);
}

export function DocumentProperties({
  types,
  typeId,
  fields,
  values,
  onTypeChange,
  onFieldChange,
}: DocumentPropertiesProps) {
  const visibleFields = fields.filter((field) => field.visibleByDefault);

  return (
    <div className="border-b border-border px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Type
      </p>
      <select
        value={typeId ?? ""}
        onChange={(event) => onTypeChange(event.target.value || null)}
        aria-label="Document type"
        className="mt-2 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-brand-500"
      >
        <option value="">No type</option>
        {types.map((type) => (
          <option key={type.id} value={type.id}>
            {type.name}
          </option>
        ))}
      </select>

      {visibleFields.length > 0 && (
        <div className="mt-3 space-y-2">
          {visibleFields.map((field) => (
            <FieldInput
              key={field.id}
              field={field}
              value={valueFor(field, values)}
              onChange={(value) => onFieldChange(field, value)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const options = selectOptions(field.config);
  const textValue = value == null ? "" : String(value);

  return (
    <label className="block">
      <span className="text-[11px] text-muted-foreground">{field.label}</span>
      {field.fieldType === "boolean" ? (
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-1 block"
        />
      ) : field.fieldType === "number" ? (
        <input
          type="number"
          value={textValue}
          onChange={(event) => onChange(event.target.value === "" ? null : event.target.value)}
          className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-brand-500"
        />
      ) : field.fieldType === "date" ? (
        <input
          type="date"
          value={textValue}
          onChange={(event) => onChange(event.target.value || null)}
          className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-brand-500"
        />
      ) : field.fieldType === "single_select" ? (
        <select
          value={textValue}
          onChange={(event) => onChange(event.target.value || null)}
          className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="">—</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : field.fieldType === "multi_select" ? (
        <select
          multiple
          value={Array.isArray(value) ? value.map(String) : []}
          onChange={(event) =>
            onChange(Array.from(event.target.selectedOptions).map((option) => option.value))
          }
          className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-brand-500"
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
          type="text"
          value={textValue}
          onChange={(event) => onChange(event.target.value)}
          className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-brand-500"
        />
      )}
    </label>
  );
}
