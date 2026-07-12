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
  readFileSync,
  realpathSync,
  rmSync,
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

// Tauri's NSIS bundler silently drops reparse points (symlinks/junctions)
// and empty directories when it packages bundle.resources -- confirmed
// live: a staged tree with a correct `node_modules/prisma` junction (and
// correct internal .pnpm peer-dep junctions below it) installs with both
// gone, breaking `require()` at the first module that resolves through
// either one. Recreating pnpm's link structure in the staged tree (the
// previous approach here) stages something that looks right and then
// doesn't survive packaging. The only tree guaranteed to survive is one
// with zero reparse points, so every symlink/junction gets fully
// dereferenced into real files up front.
//
// pnpm's store has genuine self-referencing peer-dep cycles (e.g.
// A/node_modules/B -> .pnpm/B/node_modules/B, whose own node_modules
// links back to .pnpm/A/node_modules/A) -- `visiting` tracks realpaths
// currently being materialized on the current recursion stack so a link
// back to an ancestor is skipped instead of recursing forever. Distinct
// references to the same shared dependency from different branches still
// get copied more than once (real duplicate files, not links) -- that's
// wasted disk space, not a correctness problem for the small, already
// build-pruned trees this is used on below (.next/standalone, static,
// public, bootstrap-sql). Confirmed NOT acceptable for the *whole* pnpm
// store (see the dedicated hoisted install further down instead): naively
// dereferencing every symlink in node_modules/.pnpm exploded a ~300MB
// store into 3.9GB / 252k files, which is itself enough to make cargo's
// resource-change scan (tauri-build's build.rs watches bundle.resources)
// hang for 10+ minutes before compilation even starts.
function copyTree(src, dest, visiting = new Set()) {
  const stat = lstatSync(src);
  if (stat.isSymbolicLink()) {
    const real = realpathSync(src);
    if (visiting.has(real)) {
      // Cycle back to an ancestor already being materialized -- skip.
      return;
    }
    visiting.add(real);
    copyTree(real, dest, visiting);
    visiting.delete(real);
    return;
  }
  if (stat.isDirectory()) {
    mkdirSync(dest, { recursive: true });
    for (const entry of readdirSync(src)) {
      copyTree(path.join(src, entry), path.join(dest, entry), visiting);
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
// confirmed against Dockerfile:46 (which gets away with copying the whole
// node_modules/.pnpm store because Docker's COPY preserves symlinks as-is;
// there's no NSIS step downstream to drop them). On Windows this needs a
// tree with zero symlinks/junctions (see copyTree's header above) *and*
// small enough that cargo's resource scan and NSIS packaging don't choke —
// a real `pnpm install --node-linker=hoisted` into a scratch dir gives a
// flat, link-free node_modules directly from pnpm's own local store (no
// re-download: same lockfile-pinned versions already cached from the
// `pnpm build` above), instead of hand-dereferencing the entire store.
//
// `--prod` covers @prisma/client + its engine deps (the `dependencies`
// entry), but the `prisma` CLI itself (used by the Tauri host to run
// `migrate deploy` against the bundled Postgres — task #9) is a
// devDependency, so it's added explicitly, pinned to the exact version
// pinned in this repo's own package.json so the CLI matches the schema
// it was authored against.
const depsRoot = path.join(outRoot, "deps");
rmSync(depsRoot, { recursive: true, force: true });
mkdirSync(depsRoot, { recursive: true });
copyFileSync(path.join(repoRoot, "package.json"), path.join(depsRoot, "package.json"));
copyFileSync(path.join(repoRoot, "pnpm-lock.yaml"), path.join(depsRoot, "pnpm-lock.yaml"));
// --ignore-scripts: this scratch dir has no prisma/schema.prisma (same
// reason the Dockerfile's deps stage uses it) -- the root package.json's
// `postinstall: prisma generate` would fail here otherwise. Not needed
// anyway: this install only exists to obtain physical package files
// (prisma CLI + @prisma/client's engine deps), not to regenerate client
// code -- the real generated client already came from the `pnpm build`
// above and travels via the .next/standalone copy.
execFileSync(`pnpm install --prod --node-linker=hoisted --frozen-lockfile --ignore-scripts`, {
  cwd: depsRoot,
  stdio: "inherit",
  shell: true,
});
const rootPkg = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
const prismaVersion = rootPkg.devDependencies?.prisma;
if (!prismaVersion) throw new Error("Expected a pinned `prisma` devDependency in package.json");
execFileSync(`pnpm add --prod --node-linker=hoisted --ignore-scripts prisma@${prismaVersion}`, {
  cwd: depsRoot,
  stdio: "inherit",
  shell: true,
});
// The generated client (node_modules/.prisma/client — JS + the Windows
// query-engine binary) exists only inside the repo's .pnpm store, where
// `prisma generate` put it; it is NOT part of any published package this
// scratch install can produce, and `output: "standalone"`'s trace doesn't
// carry it either (confirmed live: installed app crashed with
// `Cannot find module '.prisma/client/default'` on its first DB-touching
// route). Generate it here, directly into the hoisted tree, so it travels
// with the copy below as plain real files.
copyFileSync(path.join(repoRoot, "prisma/schema.prisma"), path.join(depsRoot, "schema.prisma"));
execFileSync(`pnpm exec prisma generate --schema=schema.prisma`, {
  cwd: depsRoot,
  stdio: "inherit",
  shell: true,
});
copy(path.join(depsRoot, "node_modules"), newNodeModules);
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
