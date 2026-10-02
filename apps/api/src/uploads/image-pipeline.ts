import sharp from "sharp";
import { fileTypeFromBuffer } from "file-type";
import { UPLOAD_MAX_INPUT_PIXELS, UPLOAD_MAX_WIDTH } from "@userhq/types";
import { ApiException } from "../common/api-error.filter.js";

export const ALLOWED_MIME_TYPES: ReadonlySet<string> = new Set([
  "image/png",
  "image/apng",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

sharp.concurrency(1);
sharp.cache(false);

let pipelineQueue = Promise.resolve();

export async function toWebp(buf: Buffer): Promise<{
  data: Buffer;
  width: number;
  height: number;
  bytes: number;
}> {
  const task = async () => {
    const ft = await fileTypeFromBuffer(buf);
    if (!ft || !ALLOWED_MIME_TYPES.has(ft.mime)) {
      throw new ApiException(
        "unsupported_type",
        415,
        "Only PNG, JPEG, WebP, and GIF images can be uploaded."
      );
    }

    try {
      const { data, info } = await sharp(buf, {
        limitInputPixels: UPLOAD_MAX_INPUT_PIXELS,
        failOn: "warning",
        animated: false,
      })
        .rotate()
        .resize({ width: UPLOAD_MAX_WIDTH, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer({ resolveWithObject: true });

      return {
        data,
        width: info.width,
        height: info.height,
        bytes: info.size,
      };
    } catch (err: any) {
      if (err instanceof ApiException) throw err;
      const msg = err?.message || "";
      if (
        msg.includes("Input image exceeds pixel limit") ||
        msg.toLowerCase().includes("pixel limit")
      ) {
        throw new ApiException(
          "image_too_large",
          422,
          "This image is over 40 megapixels. Resize it and try again."
        );
      }
      throw new ApiException(
        "image_unreadable",
        422,
        "The file looks like an image but couldn't be processed."
      );
    }
  };

  const current = pipelineQueue.then(task, task);
  pipelineQueue = current.then(
    () => {},
    () => {}
  );
  return current;
}
