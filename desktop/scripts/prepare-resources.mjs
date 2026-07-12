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
  copyFileSync,
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
// Default staging root differs by reason, not just by platform:
//  - Windows: confirmed live that makensis (a legacy 32-bit tool with no
//    long-path support) fails with "failed opening file" on real,
//    non-excludable runtime files (e.g. next/dist/compiled/*.js) once
//    nested under this repo's own path -- pnpm's .pnpm folder names plus
//    this repo's own directory depth push well past Windows' 260-char
//    MAX_PATH. Staging at a short drive-root path buys back ~60 chars,
//    which is the difference between building and not building.
//  - Docker verification of this script (task #8): node_modules/.pnpm
//    lives in a named Docker volume (fast), but this repo's own directory
//    is bind-mounted from the Windows host -- writing tens of thousands of
//    small files across that boundary is drastically slower than Docker's
//    own storage driver, so that path is set via this same override.
const defaultOutRoot =
  process.platform === "win32" ? "C:\\retailos-dist" : path.join(repoRoot, "desktop/src-tauri/resources");
const outRoot = process.env.DESKTOP_RESOURCES_ROOT ?? defaultOutRoot;
const appOut = path.join(outRoot, "app");
const newNodeModules = path.join(appOut, "node_modules");

function run(cmd, args) {
  console.log(`$ ${cmd} ${args.join(" ")}`);
  // shell: true — on Windows, pnpm resolves to a .cmd shim; execFileSync
  // can't launch that directly without shell interpretation (confirmed
  // live: plain execFileSync("pnpm", ...) fails with ENOENT there, even
  // though `pnpm` is genuinely on PATH). Harmless on POSIX (just runs
  // through /bin/sh -c). Args are fixed literals from this file, never
  // user input — folded into one string (not passed alongside shell:true)
  // to avoid Node's unescaped-argument-concatenation warning.
  execFileSync(`${cmd} ${args.join(" ")}`, { cwd: repoRoot, stdio: "inherit", shell: true });
}

// Fully resolves a symlink/junction (recursively) into real file content —
// only used as a last-resort fallback below, for a link that points
// somewhere pnpm's own store convention doesn't explain.
function copyDereferenced(src, dest) {
  const real = realpathSync(src);
  const stat = statSync(real);
  if (stat.isDirectory()) {
    mkdirSync(dest, { recursive: true });
    for (const entry of readdirSync(real)) {
      copyDereferenced(path.join(real, entry), path.join(dest, entry));
    }
  } else {
    mkdirSync(path.dirname(dest), { recursive: true });
    copyFileSync(real, dest);
  }
}

// pnpm links packages very differently by platform, and both forms embed
// an *absolute* path that breaks the moment this tree is copied anywhere
// else:
//   - Linux: relative symlinks for most internal links (travel fine
//     as-is), but Next's standalone tracer *and* pnpm itself still embed
//     a handful of absolute ones (confirmed live: `next -> /app/.next/
//     standalone/node_modules/.pnpm/next@.../node_modules/next`,
//     `.pnpm/next@X/node_modules/@swc/helpers -> /app/node_modules/
//     .pnpm/@swc+helpers@.../node_modules/@swc/helpers`).
//   - Windows: pnpm uses NTFS *junctions* for every directory-level link
//     throughout the whole .pnpm store (confirmed live via
//     `Get-Item ... | Select LinkType`) — and junctions can only ever
//     store absolute targets, that's an OS constraint, not a pnpm choice.
//     Copying via fs.cpSync tries to recurse into the junction's target
//     directory instead of preserving it, which collides with that same
//     physical directory being visited again via its own real top-level
//     .pnpm entry ("EPIPE, file in use by another process" — confirmed
//     live).
//
// Both cases are the same underlying shape: an absolute path containing a
// ".pnpm" segment. Rewriting that segment onward against the *new* tree's
// node_modules/.pnpm (copied wholesale, right below) fixes both platforms
// uniformly, with no peer-dependency enumeration needed at any depth —
// the whole store travels together and is already internally consistent.
function rewriteIntoNewPnpm(target) {
  const parts = target.split(path.sep);
  const idx = parts.lastIndexOf(".pnpm");
  if (idx === -1) return null;
  return path.join(newNodeModules, ".pnpm", ...parts.slice(idx + 1));
}

function copyTree(src, dest) {
  const stat = lstatSync(src);
  if (stat.isSymbolicLink()) {
    const target = readlinkSync(src);
    mkdirSync(path.dirname(dest), { recursive: true });
    // Defensive, not just tidy: pnpm's own store has package entries that
    // self-reference (a package's node_modules can contain a link back to
    // itself), which combined with recursing through *other* junctions
    // that happen to lead to the same physical location can mean this
    // exact destination gets reached more than once — confirmed live via
    // EEXIST. Regenerated build output, always safe to overwrite.
    rmSync(dest, { recursive: true, force: true });
    if (path.isAbsolute(target)) {
      const rewritten = rewriteIntoNewPnpm(target);
      if (rewritten === null) {
        copyDereferenced(src, dest);
        return;
      }
      const isDir = (() => {
        try {
          return statSync(target).isDirectory();
        } catch {
          return true;
        }
      })();
      symlinkSync(rewritten, dest, process.platform === "win32" ? (isDir ? "junction" : "file") : undefined);
    } else {
      // Relative symlink — travels correctly as-is since the whole
      // subtree it's relative to moves together.
      symlinkSync(target, dest);
    }
    return;
  }
  if (stat.isDirectory()) {
    mkdirSync(dest, { recursive: true });
    for (const entry of readdirSync(src)) {
      copyTree(path.join(src, entry), path.join(dest, entry));
    }
    return;
  }
  mkdirSync(path.dirname(dest), { recursive: true });
  copyFileSync(src, dest);
}

function copy(src, dest) {
  if (!existsSync(src)) throw new Error(`Expected build output missing: ${src}`);
  copyTree(src, dest);
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
copy(path.join(repoRoot, "node_modules/.pnpm"), path.join(newNodeModules, ".pnpm"));
// The `prisma` CLI (used by the Tauri host to run `migrate deploy` against
// the bundled Postgres on first run / every launch — task #9).
copy(path.join(repoRoot, "node_modules/prisma"), path.join(newNodeModules, "prisma"));
copy(path.join(repoRoot, "prisma/schema.prisma"), path.join(appOut, "prisma/schema.prisma"));
copy(path.join(repoRoot, "prisma/migrations"), path.join(appOut, "prisma/migrations"));

// Bundled as a Tauri resource (see tauri.conf.json's bundle.resources) so
// the installed app can run it without reaching into the source tree,
// which a real install won't have.
copy(
  path.join(repoRoot, "desktop/scripts/bootstrap-sql"),
  path.join(outRoot, "bootstrap-sql"),
);

console.log(`\nDone.\n  app: ${appOut}`);
