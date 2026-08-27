import { describe, expect, it } from "vitest";
import {
  canonicalizeDocumentContent,
  hashDocumentContent,
  normalizeDocumentContent,
} from "./content";

describe("document working-state content", () => {
  it("normalizes extra fields and key order into a stable document JSON", () => {
    const messy = {
      schema: "embar.document/v1",
      ignored: true,
      pages: [
        {
          level: 0,
          extra: "nope",
          body: "<p>Hello</p>",
          title: "Intro",
          id: "page-1",
        },
      ],
    };

    expect(normalizeDocumentContent(messy)).toEqual({
      schema: "embar.document/v1",
      pages: [{ id: "page-1", title: "Intro", body: "<p>Hello</p>", level: 0 }],
    });
  });

  it("produces the same SHA-256 hash for equivalent content", () => {
    const a = hashDocumentContent({
      pages: [{ id: "p1", title: "A", body: "<p>x</p>", level: 0, extra: 1 }],
    });
    const b = hashDocumentContent({
      schema: "embar.document/v1",
      pages: [{ body: "<p>x</p>", id: "p1", level: 0, title: "A" }],
    });

    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it("changes the hash when the working state changes, without using it as an id", () => {
    const original = {
      pages: [{ id: "p1", title: "", body: "<p>CV Cognata</p>", level: 0 }],
    };
    const edited = {
      pages: [{ id: "p1", title: "", body: "<p>CV Cognata updated</p>", level: 0 }],
    };

    const originalHash = hashDocumentContent(original);
    const editedHash = hashDocumentContent(edited);

    expect(editedHash).not.toBe(originalHash);
    expect(originalHash).not.toBe("p1");
    expect(canonicalizeDocumentContent(original)).not.toContain(originalHash);
  });
});
