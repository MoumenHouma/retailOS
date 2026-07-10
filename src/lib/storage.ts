import { Client } from "minio";

const endpoint = new URL(process.env.S3_ENDPOINT!);

// MinIO in dev, any S3-compatible endpoint in prod — same client either
// way. The bucket itself is provisioned by the `minio-init` service in
// docker-compose.yml (`mc mb --ignore-existing`), not here.
export const minioClient = new Client({
  endPoint: endpoint.hostname,
  port: endpoint.port ? Number(endpoint.port) : endpoint.protocol === "https:" ? 443 : 80,
  useSSL: endpoint.protocol === "https:",
  accessKey: process.env.S3_ACCESS_KEY!,
  secretKey: process.env.S3_SECRET_KEY!,
});

export const STORAGE_BUCKET = process.env.S3_BUCKET!;

export async function uploadPdf(objectName: string, buffer: Buffer): Promise<void> {
  await uploadObject(objectName, buffer, "application/pdf");
}

// Generalized for Phase 6 Chunk A's scheduled reports, which can be
// pdf/xlsx/csv — uploadPdf stays as the existing invoice-PDF call sites'
// thin wrapper around this.
export async function uploadObject(objectName: string, buffer: Buffer, contentType: string): Promise<void> {
  await minioClient.putObject(STORAGE_BUCKET, objectName, buffer, buffer.length, {
    "Content-Type": contentType,
  });
}

export async function getPdfBuffer(objectName: string): Promise<Buffer> {
  const stream = await minioClient.getObject(STORAGE_BUCKET, objectName);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}
