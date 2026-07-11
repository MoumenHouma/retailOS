import { Client } from "minio";

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

export async function uploadPdf(objectName: string, buffer: Buffer): Promise<void> {
  await uploadObject(objectName, buffer, "application/pdf");
}

// Generalized for Phase 6 Chunk A's scheduled reports, which can be
// pdf/xlsx/csv — uploadPdf stays as the existing invoice-PDF call sites'
// thin wrapper around this.
export async function uploadObject(objectName: string, buffer: Buffer, contentType: string): Promise<void> {
  await getMinioClient().putObject(STORAGE_BUCKET, objectName, buffer, buffer.length, {
    "Content-Type": contentType,
  });
}

export async function getPdfBuffer(objectName: string): Promise<Buffer> {
  const stream = await getMinioClient().getObject(STORAGE_BUCKET, objectName);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}
