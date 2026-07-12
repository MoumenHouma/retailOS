# Fetches the portable (no-installer) PostgreSQL Windows binaries and trims
# them down to just what a bundled server needs: bin/ (postgres.exe,
# initdb.exe, pg_ctl.exe, pg_isready.exe, psql.exe, createdb.exe + their
# DLLs), lib/ (shared libraries), share/ (timezone data, default config
# templates, extension SQL — initdb fails without these). Excludes pgAdmin
# 4 (670 MB, a GUI admin tool, irrelevant to a headless bundled server),
# StackBuilder, doc/, and include/ (C headers, only needed to compile
# extensions, not to run the server).
#
# Not committed to git (resources/pg/ is .gitignore'd) — this script runs
# once per machine/CI job, same spirit as `pnpm install`.
#
# fileid is specific to the 16.14 EDB zip build — bumping the Postgres
# version means finding the new fileid at
# https://www.enterprisedb.com/download-postgresql-binaries and updating
# both $Version and $DownloadUrl below.
param(
  [string]$Version = "16.14",
  [string]$DownloadUrl = "https://sbp.enterprisedb.com/getfile.jsp?fileid=1260308",
  [string]$OutDir = (Join-Path $PSScriptRoot "..\src-tauri\resources\pg")
)
$ErrorActionPreference = "Stop"

$tmpZip = Join-Path $env:TEMP "retailos-pg-$Version.zip"
$tmpExtract = Join-Path $env:TEMP "retailos-pg-$Version-extracted"

if (-not (Test-Path $tmpZip)) {
  Write-Output "Downloading PostgreSQL $Version binaries..."
  Invoke-WebRequest -Uri $DownloadUrl -OutFile $tmpZip
} else {
  Write-Output "Using cached download at $tmpZip"
}

Remove-Item -Recurse -Force $tmpExtract -ErrorAction SilentlyContinue
Write-Output "Extracting..."
Expand-Archive -Path $tmpZip -DestinationPath $tmpExtract

Remove-Item -Recurse -Force $OutDir -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

foreach ($dir in @("bin", "lib", "share")) {
  Copy-Item -Recurse -Path (Join-Path $tmpExtract "pgsql\$dir") -Destination (Join-Path $OutDir $dir)
}

Write-Output "Done: $OutDir"
$size = (Get-ChildItem $OutDir -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
"{0:N1} MB" -f $size
