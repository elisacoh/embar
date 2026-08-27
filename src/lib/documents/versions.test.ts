import { describe, expect, it } from "vitest";
import { fallbackVersionCaption, nextVersionNumber, shouldCreateNewVersion } from "./versions";

describe("document versions", () => {
  it("does not create another version when the working hash already matches the latest snapshot", () => {
    const hash = "abc123";
    expect(shouldCreateNewVersion(hash, hash)).toBe(false);
    expect(shouldCreateNewVersion(hash, "other")).toBe(true);
    expect(shouldCreateNewVersion(hash, null)).toBe(true);
  });

  it("numbers versions linearly from the latest snapshot", () => {
    expect(nextVersionNumber(null)).toBe(1);
    expect(nextVersionNumber(1)).toBe(2);
    expect(nextVersionNumber(7)).toBe(8);
  });

  it("uses vN and the date when no label is given", () => {
    expect(fallbackVersionCaption(1, "2026-08-24T10:00:00.000Z")).toEqual({
      title: "v1",
      subtitle: "24 Aug 2026",
    });
    expect(fallbackVersionCaption(3, "2026-08-24T10:00:00.000Z")).toEqual({
      title: "v3",
      subtitle: "24 Aug 2026",
    });
  });
});
