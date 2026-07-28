import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { S3Client, DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getEnv } from "../env";

export interface StorageAdapter {
  provider: "LOCAL" | "S3";
  put(bytes: Uint8Array, extension: string): Promise<string>;
  get(key: string): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
  check(): Promise<boolean>;
}

class LocalStorageAdapter implements StorageAdapter {
  provider = "LOCAL" as const;
  private readonly root = path.resolve(getEnv().LOCAL_STORAGE_PATH);

  private resolve(key: string) {
    const resolved = path.resolve(this.root, key);
    if (resolved !== this.root && !resolved.startsWith(`${this.root}${path.sep}`))
      throw new Error("Unsafe storage key");
    return resolved;
  }

  async put(bytes: Uint8Array, extension: string) {
    const date = new Date();
    const key = `${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}.${extension}`;
    const target = this.resolve(key);
    const temporary = `${target}.${randomUUID()}.tmp`;
    await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
    await writeFile(temporary, bytes, { flag: "wx", mode: 0o600 });
    await rename(temporary, target);
    return key;
  }

  async get(key: string) {
    return new Uint8Array(await readFile(this.resolve(key)));
  }

  async delete(key: string) {
    await unlink(this.resolve(key)).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }

  async check() {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    return true;
  }
}

class S3StorageAdapter implements StorageAdapter {
  provider = "S3" as const;
  private readonly env = getEnv();
  private readonly client = new S3Client({
    endpoint: this.env.S3_ENDPOINT || undefined,
    region: this.env.S3_REGION,
    forcePathStyle: this.env.S3_FORCE_PATH_STYLE === "true",
    credentials: {
      accessKeyId: this.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: this.env.S3_SECRET_ACCESS_KEY!,
    },
  });

  async put(bytes: Uint8Array, extension: string) {
    const key = `private/${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${extension}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.env.S3_BUCKET,
        Key: key,
        Body: bytes,
        ContentType: "application/octet-stream",
        ServerSideEncryption:
          this.env.S3_SERVER_SIDE_ENCRYPTION === "AES256" ? "AES256" : undefined,
      }),
    );
    return key;
  }

  async get(key: string) {
    const response = await this.client.send(new GetObjectCommand({ Bucket: this.env.S3_BUCKET, Key: key }));
    if (!response.Body) throw new Error("Storage object has no body");
    return new Uint8Array(await response.Body.transformToByteArray());
  }

  async delete(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.env.S3_BUCKET, Key: key }));
  }

  async check() {
    await this.client.send(new HeadBucketCommand({ Bucket: this.env.S3_BUCKET }));
    return true;
  }
}

let adapter: StorageAdapter | undefined;
export function getStorage(): StorageAdapter {
  adapter ??= getEnv().STORAGE_PROVIDER === "s3" ? new S3StorageAdapter() : new LocalStorageAdapter();
  return adapter;
}
