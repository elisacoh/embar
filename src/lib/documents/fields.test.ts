import { describe, expect, it } from "vitest";
import {
  emptyFieldValue,
  fieldValuesWerePreserved,
  isEmptyFieldValue,
  parseFieldValue,
  retainFieldsOnTypeChange,
  serializeFieldValue,
} from "./fields";

describe("document field values", () => {
  it("treats null, blank, and empty arrays as missing without breaking the document", () => {
    expect(isEmptyFieldValue(null)).toBe(true);
    expect(isEmptyFieldValue(undefined)).toBe(true);
    expect(isEmptyFieldValue("")).toBe(true);
    expect(isEmptyFieldValue("  ")).toBe(true);
    expect(isEmptyFieldValue([])).toBe(true);
    expect(isEmptyFieldValue({ value: null })).toBe(true);
    expect(isEmptyFieldValue("Cognata")).toBe(false);
    expect(isEmptyFieldValue(0)).toBe(false);
    expect(isEmptyFieldValue(false)).toBe(false);
  });

  it("round-trips optional values including null for target_company", () => {
    expect(parseFieldValue("text", serializeFieldValue("text", null))).toBeNull();
    expect(parseFieldValue("text", serializeFieldValue("text", "Cognata"))).toBe("Cognata");
    expect(parseFieldValue("number", serializeFieldValue("number", 3))).toBe(3);
    expect(parseFieldValue("boolean", serializeFieldValue("boolean", false))).toBe(false);
    expect(
      parseFieldValue("multi_select", serializeFieldValue("multi_select", ["English"]))
    ).toEqual(["English"]);
    expect(emptyFieldValue("single_select")).toBeNull();
  });

  it("keeps unmatched type fields as local fields and never deletes values on type change", () => {
    const cvCompany = {
      id: "v-company",
      fieldDefinitionId: "cv-company",
      localFieldKey: null,
      value: "Cognata",
      definitionKey: "target_company",
      definitionTypeId: "cv",
    };
    const recruiter = {
      id: "v-recruiter",
      fieldDefinitionId: null,
      localFieldKey: "recruiter",
      value: "Shai",
    };
    const afterGeneral = retainFieldsOnTypeChange([cvCompany, recruiter], "general", []);
    expect(afterGeneral).toHaveLength(2);
    expect(fieldValuesWerePreserved([cvCompany, recruiter], afterGeneral)).toBe(true);
    expect(afterGeneral.find((row) => row.id === "v-company")).toMatchObject({
      fieldDefinitionId: null,
      localFieldKey: "target_company",
      value: "Cognata",
    });
    expect(afterGeneral.find((row) => row.id === "v-recruiter")).toMatchObject({
      localFieldKey: "recruiter",
      value: "Shai",
    });

    const afterCv = retainFieldsOnTypeChange(afterGeneral, "cv", [
      { id: "cv-company", key: "target_company" },
    ]);
    expect(afterCv).toHaveLength(2);
    expect(fieldValuesWerePreserved(afterGeneral, afterCv)).toBe(true);
    expect(afterCv.find((row) => row.id === "v-company")).toMatchObject({
      fieldDefinitionId: "cv-company",
      localFieldKey: null,
      value: "Cognata",
    });
    expect(afterCv.find((row) => row.id === "v-recruiter")?.localFieldKey).toBe("recruiter");
  });
});
