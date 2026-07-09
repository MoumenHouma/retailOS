# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.
>
> **This file was hand-corrected on 2026-07-09** to match what was actually
> built in the redesign session (`git log` commit `d563598`), after the
> `ui-ux-pro-max` tool's auto-generated version below (Fira Code/Fira Sans,
> hex colors) turned out not to reflect the real decisions made mid-session.
> Source of truth for colors/fonts is `src/app/globals.css` and
> `src/lib/fonts.ts` — if they ever drift from this doc, they win.

---

**Project:** RetailOS
**Generated:** 2026-07-09 17:08:00 (auto) — corrected 2026-07-09 (hand)
**Category:** Retail / POS operations app (not a pure analytics dashboard — see Style Guidelines below)
**Design Dials:** Variance 4/10 (Balanced / Modern) | Motion 4/10 (Standard, mostly unimplemented — see Motion) | Density 8/10 (Dense / Dashboard)

---

## Global Rules

### Color Palette

Real tokens live in `src/app/globals.css` as OKLCH custom properties (`:root` for light, `.dark` for dark mode), mapped into Tailwind v4 via a single `@theme inline` block. Hex approximations below are for quick reference only — OKLCH is what ships.

| Role | Light (OKLCH) | Dark (OKLCH) | CSS Variable |
|------|----------------|--------------|--------------|
| Background | `oklch(1 0 0)` (white) | `oklch(0.16 0.015 258)` | `--color-background` |
| Foreground | `oklch(0.17 0.02 258)` | `oklch(0.96 0.005 258)` | `--color-foreground` |
| Card | `oklch(1 0 0)` | `oklch(0.2 0.018 258)` | `--color-card` |
| Primary | `oklch(0.42 0.17 258)` (rich blue) | `oklch(0.62 0.17 258)` | `--color-primary` |
| Secondary | `oklch(0.95 0.015 258)` | `oklch(0.26 0.02 258)` | `--color-secondary` |
| Muted | `oklch(0.96 0.01 258)` | `oklch(0.24 0.02 258)` | `--color-muted` |
| Accent | `oklch(0.94 0.02 258)` | `oklch(0.28 0.025 258)` | `--color-accent` |
| **Success** (new) | `oklch(0.6 0.14 152)` (green) | `oklch(0.68 0.15 152)` | `--color-success` |
| **Warning** (new) | `oklch(0.78 0.15 75)` (amber) | `oklch(0.78 0.15 75)` | `--color-warning` |
| Destructive | `oklch(0.55 0.22 27)` (red) | `oklch(0.62 0.2 27)` | `--color-destructive` |
| Border/Input | `oklch(0.9 0.01 258)` | `oklch(0.3 0.02 258)` | `--color-border` / `--color-input` |
| Ring | `oklch(0.42 0.17 258)` | `oklch(0.68 0.16 258)` | `--color-ring` |

Every role has a matching `-foreground` token (e.g. `--color-primary-foreground`) for text-on-color contrast — see `globals.css` for the full set.

**Color notes:** All hues sit near 258° (blue) except success (152°, green) and warning (75°, amber) — a monochrome-blue UI with semantic status colors standing out deliberately. `success`/`warning` didn't exist before this pass; status colors used to be faked with the 4 stock Badge variants.

### Typography

- **Heading Font:** Lexend (`next/font/google`, Latin subset)
- **Body Font:** Source Sans 3 (`next/font/google`, Latin subset)
- **Arabic (both roles):** Cairo (`next/font/google`, Arabic + Latin subsets) — swapped in via `html[lang="ar"]` CSS override in `globals.css`, not server-side branching
- **Why not Fira Code/Fira Sans:** the `ui-ux-pro-max` tool's own default recommendation was rejected — a monospace-headline "data terminal" look reads as a dev tool, not retail-staff software. Confirmed with the user mid-session before committing.
- All three font families load on every page (`preload: false` on each, per `src/lib/fonts.ts`) since only one pair is active per locale and preloading the other two would waste bandwidth.

**Actual font setup** (`src/lib/fonts.ts`):
```ts
import { Cairo, Lexend, Source_Sans_3 } from "next/font/google";

export const lexend = Lexend({ subsets: ["latin"], variable: "--font-lexend", display: "swap", preload: false });
export const sourceSans3 = Source_Sans_3({ subsets: ["latin"], variable: "--font-source-sans", display: "swap", preload: false });
export const cairo = Cairo({ subsets: ["arabic", "latin"], variable: "--font-cairo", display: "swap", preload: false });
```

### Spacing Variables

**Not implemented as named CSS variables.** Neither `--space-*` nor `--shadow-*` (below) exist in `globals.css` — the app uses Tailwind's built-in spacing/shadow scale directly (`p-4`, `gap-2`, `shadow-md`, etc.), not these specific custom tokens. Kept as a density reference (the actual pixel values are close to Tailwind's defaults at each named step), not a literal token list to import.

*Density: 8/10 — Dense / Dashboard*

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `2px` / `0.125rem` | Tight gaps |
| `--space-sm` | `4px` / `0.25rem` | Icon gaps, inline spacing |
| `--space-md` | `8px` / `0.5rem` | Standard padding |
| `--space-lg` | `12px` / `0.75rem` | Section padding |
| `--space-xl` | `16px` / `1rem` | Large gaps |
| `--space-2xl` | `24px` / `1.5rem` | Section margins |
| `--space-3xl` | `32px` / `2rem` | Hero padding |

### Shadow Depths

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` | Cards, buttons |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, dropdowns |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` | Hero images, featured cards |

---

## Component Specs

**Not custom CSS classes.** The app uses shadcn/ui primitives (Button, Card, Input, Dialog, Badge, Sheet, Tooltip, Skeleton, Avatar — added via the shadcn CLI) styled through the CSS variables above and Tailwind utility classes, not hand-rolled `.btn-primary`/`.card`/`.modal` classes. The blocks below (kept from the auto-generated version) describe the *intended look* in plain CSS terms — treat them as a spec for shadcn variant/className choices, not literal classes to write.

- **Buttons:** primary = filled `--color-primary`/`--color-primary-foreground`, `rounded-lg` (8px), `font-semibold`, subtle hover lift. Secondary = outline variant, 2px border in `--color-primary`.
- **Cards:** `--color-card` background, `rounded-xl` (12px), `shadow-md` resting / `shadow-lg` hover.
- **Inputs:** 1px `--color-border`, `rounded-lg`, focus ring via `--color-ring` at ~20% opacity (shadcn's default focus-visible ring pattern).
- **Modals (Dialog/Sheet):** overlay `rgba(0,0,0,0.5)` + blur, panel `rounded-2xl` (16px), `shadow-xl`.

Repo-specific shared components built on top of these primitives (see `src/components/`): `StatusBadge` (domain-aware status→tone mapping for PO/transfer/count/invoice/sale — `src/components/ui/status-badge.tsx`), `PageHeader`, `ForbiddenState`, `StatTile`.

---

## Style Guidelines

**Style:** Retail operations software (Shopify POS / Square / Lightspeed / Odoo reference points, per the actual redesign brief) — **not** a pure analytics dashboard. The auto-generated "Data-Dense Dashboard" framing below is kept for its still-relevant density/table guidance, but don't let "dashboard" narrow the app's identity — most screens are transactional (POS checkout, PO lifecycle, stock counts), not read-only reporting.

**Keywords:** Data tables, KPI strips, grouped sidebar nav (Ventes/Achats/Stock/Rapports), touch-friendly POS controls, space-efficient but not cramped

**Best For:** Multi-tenant retail management — POS, inventory, purchasing, invoicing

**Key Effects:** Hover states with smooth transitions, status badges with tone-mapped colors, KPI tiles on dashboard/reports pages

### Page Pattern

The auto-generated "Real-Time / Operations Landing" marketing-page pattern below never applied to this internal app (no hero/CTA/trial-sandbox flow exists or was needed) — left here only because deleting it loses no real information; don't follow it for new pages.

<details>
<summary>Original auto-generated pattern (not used)</summary>

**Pattern Name:** Real-Time / Operations Landing
- **Conversion Strategy:** For ops/security/iot products. Demo or sandbox link. Trust signals.
- **CTA Placement:** Primary CTA in nav + After metrics
- **Section Order:** 1. Hero (product + live preview or status), 2. Key metrics/indicators, 3. How it works, 4. CTA (Start trial / Contact)

</details>

---

## Motion

**Not implemented.** GSAP (referenced below) isn't installed anywhere in the repo (`package.json` has no `gsap` dependency) — this whole section is the tool's aspirational spec from before the real redesign session, which didn't build page-transition animations. Kept as a spec in case this is picked up later; don't assume it exists.

<details>
<summary>Original auto-generated spec (unimplemented)</summary>

**Page Transition** (Standard) — Trigger: route change | Duration: 400-600ms | Easing: `power2.inOut`

```js
const tl = gsap.timeline(); tl.to('.transition-overlay', { yPercent: 0, duration: 0.4, ease: 'power2.inOut' }).call(navigate).to('.transition-overlay', { yPercent: -100, duration: 0.4, ease: 'power2.inOut', delay: 0.1 });
```

**Framework notes:** Keep the overlay element mounted at the layout root (outside the page component) so it survives the route swap

- ✅ Show a lightweight loading indicator if the destination route's data fetch outlasts the overlay
- ❌ Don't tie the overlay's reveal directly to data-fetch completion without a max-wait timeout; a slow API stalls the whole transition
- ⚡ Prefer CSS transform (yPercent) over top/left to keep the overlay animation on the compositor thread

</details>

---

## Anti-Patterns (Do NOT Use)

- ❌ Ornate design
- ❌ No filtering

### Additional Forbidden Patterns

- ❌ **Emojis as icons** — Use SVG icons (Heroicons, Lucide, Simple Icons)
- ❌ **Missing cursor:pointer** — All clickable elements must have cursor:pointer
- ❌ **Layout-shifting hovers** — Avoid scale transforms that shift layout
- ❌ **Low contrast text** — Maintain 4.5:1 minimum contrast ratio
- ❌ **Instant state changes** — Always use transitions (150-300ms)
- ❌ **Invisible focus states** — Focus states must be visible for a11y

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (Heroicons/Lucide)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile
