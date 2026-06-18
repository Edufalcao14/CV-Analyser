import { describe, it, expect } from "vitest";
import { getRegionNotes } from "./rubric";

describe("getRegionNotes", () => {
  it("returns Brazil notes for Portuguese", () => {
    const notes = getRegionNotes("pt").join(" ");
    expect(notes).toMatch(/brazilian|resumo|cpf/i);
  });

  it("returns EU/Belgium notes for French and English", () => {
    expect(getRegionNotes("fr").join(" ")).toMatch(/belgi|eu\/belgian/i);
    expect(getRegionNotes("en").join(" ")).toMatch(/belgi|eu\/belgian/i);
  });
});
