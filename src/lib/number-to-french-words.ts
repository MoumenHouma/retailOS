const ONES = [
  "",
  "un",
  "deux",
  "trois",
  "quatre",
  "cinq",
  "six",
  "sept",
  "huit",
  "neuf",
  "dix",
  "onze",
  "douze",
  "treize",
  "quatorze",
  "quinze",
  "seize",
  "dix-sept",
  "dix-huit",
  "dix-neuf",
];

const TENS = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante", "quatre-vingt", "quatre-vingt"];

/** 0-99, standard (non-Belgian) French rules: soixante-dix, quatre-vingts. */
function twoDigitsToWords(n: number): string {
  if (n < 20) return ONES[n] ?? "";

  const tensDigit = Math.floor(n / 10);
  const remainder = n % 10;
  const tensWord = TENS[tensDigit] ?? "";

  // 70-79 and 90-99 are built on 60/80 + a teen (soixante-quinze, quatre-vingt-treize).
  // 71 is the one exception: "soixante et onze" takes "et" like 61's
  // "soixante et un", unlike 91's "quatre-vingt-onze" (quatre-vingt is
  // already a compound, so it never takes "et").
  if (tensDigit === 7 || tensDigit === 9) {
    if (tensDigit === 7 && remainder === 1) {
      return `${tensWord} et ${ONES[11]}`;
    }
    return `${tensWord}-${ONES[10 + remainder] ?? ""}`;
  }

  if (remainder === 0) {
    // "quatre-vingts" takes the plural -s only standing alone; 80 is the
    // sole tens word affected (vingt/trente/... never pluralize like this).
    return tensDigit === 8 ? `${tensWord}s` : tensWord;
  }

  if (remainder === 1 && tensDigit !== 8) {
    return `${tensWord} et un`;
  }

  return `${tensWord}-${ONES[remainder] ?? ""}`;
}

function threeDigitsToWords(n: number): string {
  const hundreds = Math.floor(n / 100);
  const remainder = n % 100;

  const parts: string[] = [];
  if (hundreds > 0) {
    parts.push(hundreds === 1 ? "cent" : `${ONES[hundreds] ?? ""} cent${remainder === 0 ? "s" : ""}`);
  }
  if (remainder > 0) {
    parts.push(twoDigitsToWords(remainder));
  }
  return parts.join(" ");
}

/** Integer 0 to 999,999,999,999 (DA amounts never approach this). */
export function integerToFrenchWords(value: number): string {
  if (value === 0) return "zéro";

  const billions = Math.floor(value / 1_000_000_000);
  const millions = Math.floor((value % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((value % 1_000_000) / 1_000);
  const units = value % 1_000;

  const parts: string[] = [];
  if (billions > 0) {
    parts.push(`${threeDigitsToWords(billions)} milliard${billions > 1 ? "s" : ""}`);
  }
  if (millions > 0) {
    parts.push(`${threeDigitsToWords(millions)} million${millions > 1 ? "s" : ""}`);
  }
  if (thousands > 0) {
    // "mille" is invariable and drops "un" (1000 = "mille", not "un mille").
    parts.push(thousands === 1 ? "mille" : `${threeDigitsToWords(thousands)} mille`);
  }
  if (units > 0) {
    parts.push(threeDigitsToWords(units));
  }

  return parts.join(" ");
}

/**
 * DÉCRET 05-468 requires the invoice total spelled out in French, e.g.
 * "Neuf mille sept cent deux dinars et cinquante centimes." `totalCentimes`
 * is the invoice's net-to-pay amount in centimes (1 DA = 100 centimes).
 */
export function amountToFrenchWords(totalCentimes: number): string {
  const dinars = Math.floor(totalCentimes / 100);
  const centimes = totalCentimes % 100;

  const dinarsWords = `${integerToFrenchWords(dinars)} dinar${dinars > 1 ? "s" : ""}`;
  if (centimes === 0) {
    return capitalize(`${dinarsWords}.`);
  }

  const centimesWords = `${integerToFrenchWords(centimes)} centime${centimes > 1 ? "s" : ""}`;
  return capitalize(`${dinarsWords} et ${centimesWords}.`);
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
