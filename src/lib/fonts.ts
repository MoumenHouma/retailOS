import { Cairo, Lexend, Source_Sans_3 } from "next/font/google";

// preload: false on all three — every page loads all three variable fonts
// (see [locale]/layout.tsx), but only one pair is actually used depending
// on locale (see globals.css's html[lang="ar"] override), so preloading
// all of them would always waste bandwidth on 2 of 3 unused fonts per page.
export const lexend = Lexend({
  subsets: ["latin"],
  variable: "--font-lexend",
  display: "swap",
  preload: false,
});

export const sourceSans3 = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-source-sans",
  display: "swap",
  preload: false,
});

export const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  display: "swap",
  preload: false,
});
