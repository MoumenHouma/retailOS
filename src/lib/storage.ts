import { Client } from "minio";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// MinIO in dev, any S3-compatible endpoint in prod — same client either
// way. The bucket itself is provisioned by the `minio-init` service in
// docker-compose.yml (`mc mb --ignore-existing`), not here.
//
// Built lazily (not at module scope): this module is reachable from every
// route via service-errors.ts's blanket import of every service's error
// classes (including invoices.ts), so eagerly parsing S3_ENDPOINT here
// broke `next build`'s page-data collection for unrelated routes on
// deployments where S3_ENDPOINT isn't set — `new URL(undefined)` throws
// "TypeError: Invalid URL" just from importing the module.
let client: Client | undefined;

function getMinioClient(): Client {
  if (!client) {
    const endpoint = new URL(process.env.S3_ENDPOINT!);
    client = new Client({
      endPoint: endpoint.hostname,
      port: endpoint.port ? Number(endpoint.port) : endpoint.protocol === "https:" ? 443 : 80,
      useSSL: endpoint.protocol === "https:",
      accessKey: process.env.S3_ACCESS_KEY!,
      secretKey: process.env.S3_SECRET_KEY!,
    });
  }
  return client;
}

export const STORAGE_BUCKET = process.env.S3_BUCKET!;

// Desktop edition has no MinIO bundled (it's a single-PC install, not
// worth a third sidecar for two file types) — writes/reads plain files
// under STORAGE_FS_ROOT instead (Tauri sets this to
// %APPDATA%\RetailOS\storage). Read lazily, same discipline as the S3
// client above: this branch check must never throw at import time.
function storageDriver(): "s3" | "fs" {
  return process.env.STORAGE_DRIVER === "fs" ? "fs" : "s3";
}

// objectName is always server-generated (e.g. `invoices/${tenantId}/${id}.pdf`,
// `reports/${tenantId}/${scheduledReportId}/${filename}`), never taken
// directly from user input — but resolve-and-verify anyway rather than
// trust that invariant forever.
function resolveFsPath(objectName: string): string {
  const root = path.resolve(process.env.STORAGE_FS_ROOT ?? "");
  const resolved = path.resolve(root, objectName);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error(`Invalid storage object name: ${objectName}`);
  }
  return resolved;
}

export async function uploadPdf(objectName: string, buffer: Buffer): Promise<void> {
  await uploadObject(objectName, buffer, "application/pdf");
}

// Generalized for Phase 6 Chunk A's scheduled reports, which can be
// pdf/xlsx/csv — uploadPdf stays as the existing invoice-PDF call sites'
// thin wrapper around this.
export async function uploadObject(objectName: string, buffer: Buffer, contentType: string): Promise<void> {
  if (storageDriver() === "fs") {
    const filePath = resolveFsPath(objectName);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, buffer);
    return;
  }
  await getMinioClient().putObject(STORAGE_BUCKET, objectName, buffer, buffer.length, {
    "Content-Type": contentType,
  });
}

export async function getPdfBuffer(objectName: string): Promise<Buffer> {
  if (storageDriver() === "fs") {
    return readFile(resolveFsPath(objectName));
  }
  const stream = await getMinioClient().getObject(STORAGE_BUCKET, objectName);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}
