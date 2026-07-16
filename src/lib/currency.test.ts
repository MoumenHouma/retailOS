import { describe, it, expect } from "vitest";
import { centimesToDa, daToCentimes, formatDa } from "./currency";

describe("centimesToDa", () => {
  it("converts whole and fractional DA amounts", () => {
    expect(centimesToDa(0)).toBe(0);
    expect(centimesToDa(100)).toBe(1);
    expect(centimesToDa(150)).toBe(1.5);
    expect(centimesToDa(199_999)).toBeCloseTo(1999.99);
  });
});

describe("daToCentimes", () => {
  it("converts whole and fractional DA amounts to integer centimes", () => {
    expect(daToCentimes(0)).toBe(0);
    expect(daToCentimes(1)).toBe(100);
    expect(daToCentimes(1.5)).toBe(150);
  });

  it("rounds away floating-point drift instead of truncating", () => {
    // 19.99 * 100 is 1998.9999999999998 in IEEE 754 float math; the
    // Math.round in daToCentimes must correct that back to 1999, not 1998.
    expect(daToCentimes(19.99)).toBe(1999);
  });
});

describe("formatDa", () => {
  it("always shows exactly two decimal places", () => {
    expect(formatDa(100)).toBe("1,00 DA");
    expect(formatDa(150)).toBe("1,50 DA");
    expect(formatDa(0)).toBe("0,00 DA");
  });

  it("groups thousands using the fr-FR locale separator", () => {
    // fr-FR's Intl thousands separator is U+202F (narrow no-break space),
    // not a regular space or comma.
    expect(formatDa(123_456)).toBe(`1\u202F234,56 DA`);
  });
});
