// Prices are stored as integer centimes (matches product-export/import
// conventions) — 1 DA = 100.
export function centimesToDa(centimes: number): number {
  return centimes / 100;
}

export function daToCentimes(da: number): number {
  return Math.round(da * 100);
}

export function formatDa(centimes: number): string {
  return `${centimesToDa(centimes).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} DA`;
}
