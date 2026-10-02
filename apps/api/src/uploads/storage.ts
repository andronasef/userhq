import * as crypto from "node:crypto";
import * as path from "node:path";
import * as fsPromises from "node:fs/promises";
import { UPLOAD_URL_PATTERN } from "@userhq/types";

export function uploadKey(now: Date, id?: string): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const uuid = (id ?? crypto.randomUUID()).toLowerCase();
  return `${year}/${month}/${uuid}.webp`;
}

export async function writeUpload(
  dir: string,
  data: Buffer,
  now: Date,
  fsImpl?: typeof import("node:fs/promises")
): Promise<{ key: string; url: string; absPath: string }> {
  const fs = fsImpl ?? fsPromises;
  const key = uploadKey(now);
  const tmpName = crypto.randomUUID().toLowerCase();
  const resolvedDir = path.resolve(dir);
  const tmpDir = path.join(resolvedDir, ".tmp");
  const tmpPath = path.join(tmpDir, tmpName);

  const absPath = path.resolve(dir, key);
  if (!absPath.startsWith(resolvedDir + path.sep)) {
    throw new Error("Path traversal detected");
  }

  let tmpWritten = false;
  try {
    await fs.mkdir(tmpDir, { recursive: true });
    await fs.writeFile(tmpPath, data, { flag: "wx" });
    tmpWritten = true;

    await fs.mkdir(path.dirname(absPath), { recursive: true });
    await fs.rename(tmpPath, absPath);
    tmpWritten = false;
  } catch (err) {
    if (tmpWritten) {
      await fs.unlink(tmpPath).catch(() => {});
    }
    throw err;
  }

  const url = "/uploads/" + key;
  if (!UPLOAD_URL_PATTERN.test(url)) {
    throw new Error(`Invalid upload URL: ${url}`);
  }

  return { key, url, absPath };
}

export async function removeUpload(absPath: string): Promise<void> {
  await fsPromises.unlink(absPath).catch(() => {});
}

export async function assertWritable(
  dir: string,
  fsImpl?: typeof import("node:fs/promises")
): Promise<void> {
  const fs = fsImpl ?? fsPromises;
  try {
    const resolvedDir = path.resolve(dir);
    const tmpDir = path.join(resolvedDir, ".tmp");
    await fs.mkdir(resolvedDir, { recursive: true });
    await fs.mkdir(tmpDir, { recursive: true });
    const probePath = path.join(resolvedDir, ".probe");
    await fs.writeFile(probePath, "probe", { flag: "w" });
    await fs.unlink(probePath);
  } catch {
    throw new Error(`UPLOAD_DIR is not writable: ${dir}`);
  }
}
