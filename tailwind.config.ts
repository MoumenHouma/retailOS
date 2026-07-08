import type { Config } from "tailwindcss";

// Tailwind CSS 4 is CSS-first — most theme tokens live in src/app/globals.css
// under an @theme block. This file only needs to point at content sources
// and hold any settings the shadcn/ui CLI still expects to find here.
const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
};

export default config;
