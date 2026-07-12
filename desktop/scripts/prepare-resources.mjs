#!/usr/bin/env node
// Desktop packaging step 3 (see .claude/plans reactive-popping-rain.md §4):
// builds the app the normal way, then assembles the exact file set a Tauri
// sidecar needs to run `node server.js` (and, later, `prisma migrate deploy`)
// with zero pnpm/dev toolchain present.
//
// Mirrors Dockerfile's runner stage (COPY list) — that's the confirmed,
// already-working manifest of what `output: "standalone"` does NOT trace on
// its own (notably Prisma's native query-engine binary, which lives under
// node_modules/.pnpm, not node_modules/@prisma/client).
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(fileURLToPath(import.meta.url), "../../..");
// Overridable only for the Docker-based dev verification of this script:
// node_modules/.pnpm lives in a named Docker volume (fast), but this repo's
// own directory is bind-mounted from the Windows host — writing tens of
// thousands of small files across that boundary is drastically slower than
// Docker's own storage driver. The real Tauri build runs this script
// directly on Windows with no Docker involved, so this override won't be
// needed there.
const outRoot = process.env.DESKTOP_RESOURCES_ROOT ?? path.join(repoRoot, "desktop/src-tauri/resources");
const appOut = path.join(outRoot, "app");

function run(cmd, args) {
  console.log(`$ ${cmd} ${args.join(" ")}`);
  execFileSync(cmd, args, { cwd: repoRoot, stdio: "inherit" });
}

function copy(src, dest) {
  if (!existsSync(src)) throw new Error(`Expected build output missing: ${src}`);
  mkdirSync(path.dirname(dest), { recursive: true });
  cpSync(src, dest, { recursive: true });
}

// Next's standalone tracer embeds *absolute-path* symlinks for the
// top-level packages it traces directly into node_modules (e.g.
// `next -> /app/.next/standalone/node_modules/.pnpm/next@.../node_modules/next`,
// `@prisma/client -> .../node_modules/.pnpm/@prisma+client@.../node_modules/@prisma/client`)
// — confirmed live, for plain packages, scoped (@scope/pkg) ones, and
// dot-namespaced ones (Prisma's generated `.prisma/client`) alike. Copying
// that tree to any other absolute path (a different Docker container, or
// the real Windows Tauri resource dir) leaves those symlinks dangling and
// `node server.js` fails with "Cannot find module 'next'" and similar.
//
// Earlier attempt fully dereferenced each one (real files, no symlink) —
// but that only resolves the package's *own* files, not its private peer
// deps (pnpm keeps a package's peers as siblings in the same virtual-store
// node_modules folder, e.g. `@swc/helpers` next to `next`, and this nests
// arbitrarily deep: @react-pdf/renderer needs @react-pdf/font needs
// is-url, each one more level pnpm resolves the same way). Chasing every
// transitive peer by hand doesn't terminate.
//
// Correct fix: rewrite the symlink as an equivalent *relative* one
// pointing into node_modules/.pnpm, which is copied wholesale (symlinks
// preserved) later in this script. The whole store travels together and
// is already internally self-consistent (this is exactly what the
// already-proven Dockerfile COPY pattern relies on) — no peer enumeration
// needed at any depth.
function fixAbsoluteSymlink(entryPath, nodeModulesDir) {
  if (!lstatSync(entryPath).isSymbolicLink()) return;
  if (!path.isAbsolute(readlinkSync(entryPath))) return;
  const real = realpathSync(entryPath);
  const parts = real.split(path.sep);
  const idx = parts.lastIndexOf(".pnpm");
  if (idx === -1) throw new Error(`Absolute symlink target has no .pnpm segment: ${entryPath} -> ${real}`);
  const realInNewTree = path.join(nodeModulesDir, ".pnpm", ...parts.slice(idx + 1));
  const relTarget = path.relative(path.dirname(entryPath), realInNewTree);
  rmSync(entryPath, { recursive: true, force: true });
  symlinkSync(relTarget, entryPath);
}

// Checked one level deep for every directory entry, not just `@scope`
// ones — Prisma's generated client is reached via a *dot*-prefixed
// namespace (`node_modules/.prisma/client -> .../node_modules/
// .pnpm/@prisma+client@.../node_modules/.prisma/client`), the same
// pattern as `@scope/pkg`, confirmed live via the same
// "Cannot find module '.prisma/client/default'" failure mode.
// `scanDir` is the folder whose entries get checked (could be the top-level
// node_modules, or a package variant's own private one inside .pnpm);
// `pnpmRoot` is always the *top-level* node_modules — the one whose .pnpm
// subfolder is the real, single copy every relative symlink must point
// back into, regardless of which directory is currently being scanned.
function fixAbsoluteSymlinks(scanDir, pnpmRoot) {
  for (const entry of readdirSync(scanDir)) {
    const entryPath = path.join(scanDir, entry);
    if (lstatSync(entryPath).isSymbolicLink()) {
      fixAbsoluteSymlink(entryPath, pnpmRoot);
    } else if (statSync(entryPath).isDirectory()) {
      for (const nested of readdirSync(entryPath)) {
        fixAbsoluteSymlink(path.join(entryPath, nested), pnpmRoot);
      }
    }
  }
}

run("pnpm", ["exec", "prisma", "generate"]);
run("pnpm", ["build"]);

rmSync(appOut, { recursive: true, force: true });
mkdirSync(appOut, { recursive: true });

// The running `node server.js` process.
copy(path.join(repoRoot, ".next/standalone"), appOut);
copy(path.join(repoRoot, ".next/static"), path.join(appOut, ".next/static"));
// This repo has no public/ directory yet (no static assets checked in) —
// confirmed live, same as Dockerfile's runner stage. An empty directory
// copies cleanly; real assets can be added later without touching this
// script.
if (existsSync(path.join(repoRoot, "public"))) {
  copy(path.join(repoRoot, "public"), path.join(appOut, "public"));
} else {
  mkdirSync(path.join(appOut, "public"), { recursive: true });
}
// output: "standalone"'s trace doesn't include Prisma's native engine —
// confirmed against Dockerfile:46. Without this the server crashes on its
// first query with a missing-query-engine error, not a clean failure.
copy(path.join(repoRoot, "node_modules/.pnpm"), path.join(appOut, "node_modules/.pnpm"));
// The `prisma` CLI (used by the Tauri host to run `migrate deploy` against
// the bundled Postgres on first run / every launch — task #9). pnpm's own
// node_modules/prisma is a *relative* symlink into node_modules/.pnpm
// (confirmed: `.pnpm/prisma@6.2.1/node_modules/prisma`), so copying it
// alongside the .pnpm copy above — both plain, symlink-preserving copies —
// resolves correctly with no duplication of the whole store.
copy(path.join(repoRoot, "node_modules/prisma"), path.join(appOut, "node_modules/prisma"));
copy(path.join(repoRoot, "prisma/schema.prisma"), path.join(appOut, "prisma/schema.prisma"));
copy(path.join(repoRoot, "prisma/migrations"), path.join(appOut, "prisma/migrations"));

// Run after the .pnpm copy above (not before): these are now relative
// symlinks pointing into it, so their target only needs to exist by the
// time the server actually runs, not at copy time — but keeping this last
// documents that dependency clearly.
const topNodeModules = path.join(appOut, "node_modules");
fixAbsoluteSymlinks(topNodeModules, topNodeModules);
// pnpm doesn't only produce absolute symlinks at the top level — a package
// variant's own private node_modules folder inside .pnpm can *also* embed
// an absolute cross-reference to a shared, non-variant dependency (e.g.
// `.pnpm/next@X.../node_modules/@swc/helpers ->
// /app/node_modules/.pnpm/@swc+helpers@0.5.15/node_modules/@swc/helpers`)
// — confirmed live, this is pnpm's own doing, not just Next's tracer. So
// every package's private node_modules folder needs the same check, not
// just the outermost one.
const pnpmDir = path.join(topNodeModules, ".pnpm");
for (const pkgDir of readdirSync(pnpmDir)) {
  const pkgNodeModules = path.join(pnpmDir, pkgDir, "node_modules");
  if (existsSync(pkgNodeModules)) fixAbsoluteSymlinks(pkgNodeModules, topNodeModules);
}

console.log(`\nDone.\n  app: ${appOut}`);
