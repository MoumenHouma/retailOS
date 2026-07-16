import { describe, it, expect } from "vitest";
import { integerToFrenchWords, amountToFrenchWords } from "./number-to-french-words";

describe("integerToFrenchWords", () => {
  it("spells zero", () => {
    expect(integerToFrenchWords(0)).toBe("zéro");
  });

  it("spells ones and teens", () => {
    expect(integerToFrenchWords(1)).toBe("un");
    expect(integerToFrenchWords(9)).toBe("neuf");
    expect(integerToFrenchWords(10)).toBe("dix");
    expect(integerToFrenchWords(11)).toBe("onze");
    expect(integerToFrenchWords(16)).toBe("seize");
    expect(integerToFrenchWords(17)).toBe("dix-sept");
    expect(integerToFrenchWords(19)).toBe("dix-neuf");
  });

  it("spells the regular tens (20-69)", () => {
    expect(integerToFrenchWords(20)).toBe("vingt");
    expect(integerToFrenchWords(21)).toBe("vingt et un");
    expect(integerToFrenchWords(22)).toBe("vingt-deux");
    expect(integerToFrenchWords(29)).toBe("vingt-neuf");
    expect(integerToFrenchWords(30)).toBe("trente");
    expect(integerToFrenchWords(31)).toBe("trente et un");
    expect(integerToFrenchWords(60)).toBe("soixante");
    expect(integerToFrenchWords(61)).toBe("soixante et un");
    expect(integerToFrenchWords(69)).toBe("soixante-neuf");
  });

  it("spells the 70s as soixante + teen, with 71 as the 'et' exception", () => {
    expect(integerToFrenchWords(70)).toBe("soixante-dix");
    expect(integerToFrenchWords(71)).toBe("soixante et onze");
    expect(integerToFrenchWords(72)).toBe("soixante-douze");
    expect(integerToFrenchWords(75)).toBe("soixante-quinze");
    expect(integerToFrenchWords(79)).toBe("soixante-dix-neuf");
  });

  it("spells 80 as plural only standing alone", () => {
    expect(integerToFrenchWords(80)).toBe("quatre-vingts");
    expect(integerToFrenchWords(81)).toBe("quatre-vingt-un");
    expect(integerToFrenchWords(88)).toBe("quatre-vingt-huit");
    expect(integerToFrenchWords(89)).toBe("quatre-vingt-neuf");
  });

  it("spells the 90s as quatre-vingt + teen, with no 'et' at 91", () => {
    expect(integerToFrenchWords(90)).toBe("quatre-vingt-dix");
    expect(integerToFrenchWords(91)).toBe("quatre-vingt-onze");
    expect(integerToFrenchWords(95)).toBe("quatre-vingt-quinze");
    expect(integerToFrenchWords(99)).toBe("quatre-vingt-dix-neuf");
  });

  it("spells hundreds, singular 'cent' vs plural 'cents'", () => {
    expect(integerToFrenchWords(100)).toBe("cent");
    expect(integerToFrenchWords(101)).toBe("cent un");
    expect(integerToFrenchWords(110)).toBe("cent dix");
    expect(integerToFrenchWords(111)).toBe("cent onze");
    expect(integerToFrenchWords(200)).toBe("deux cents");
    expect(integerToFrenchWords(201)).toBe("deux cent un");
    expect(integerToFrenchWords(999)).toBe("neuf cent quatre-vingt-dix-neuf");
  });

  it("spells thousands, invariable 'mille' with no leading 'un'", () => {
    expect(integerToFrenchWords(1000)).toBe("mille");
    expect(integerToFrenchWords(1001)).toBe("mille un");
    expect(integerToFrenchWords(2000)).toBe("deux mille");
    expect(integerToFrenchWords(2021)).toBe("deux mille vingt et un");
  });

  it("spells millions and billions, singular vs plural", () => {
    expect(integerToFrenchWords(1_000_000)).toBe("un million");
    expect(integerToFrenchWords(2_000_000)).toBe("deux millions");
    expect(integerToFrenchWords(1_000_000_000)).toBe("un milliard");
    expect(integerToFrenchWords(2_000_000_000)).toBe("deux milliards");
  });

  it("combines every magnitude in one number", () => {
    expect(integerToFrenchWords(123_456_789)).toBe(
      "cent vingt-trois millions quatre cent cinquante-six mille sept cent quatre-vingt-neuf",
    );
  });
});

describe("amountToFrenchWords", () => {
  it("handles a zero amount", () => {
    expect(amountToFrenchWords(0)).toBe("Zéro dinar.");
  });

  it("handles centimes-only amounts", () => {
    expect(amountToFrenchWords(1)).toBe("Zéro dinar et un centime.");
  });

  it("omits the centimes clause when there are none, and pluralizes 'dinar'", () => {
    expect(amountToFrenchWords(100)).toBe("Un dinar.");
    expect(amountToFrenchWords(200)).toBe("Deux dinars.");
  });

  it("includes both clauses and pluralizes 'centime'", () => {
    expect(amountToFrenchWords(150)).toBe("Un dinar et cinquante centimes.");
    expect(amountToFrenchWords(101)).toBe("Un dinar et un centime.");
  });

  it("spells a realistic invoice total (DÉCRET 05-468 wording)", () => {
    expect(amountToFrenchWords(950_250)).toBe("Neuf mille cinq cent deux dinars et cinquante centimes.");
  });
});
