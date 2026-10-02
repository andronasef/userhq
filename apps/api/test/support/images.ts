import * as zlib from "node:zlib";
import sharp from "sharp";

export async function pngOfSize(w: number, h: number): Promise<Buffer> {
  return sharp({
    create: {
      width: w,
      height: h,
      channels: 4,
      background: { r: 100, g: 150, b: 200, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
}

export function padPngTo(buf: Buffer, totalBytes: number): Buffer {
  if (buf.length > totalBytes) {
    throw new Error(
      `Buffer already larger than target bytes: ${buf.length} > ${totalBytes}`
    );
  }
  const needed = totalBytes - buf.length;
  if (needed < 12) {
    throw new Error(`Cannot pad less than 12 bytes chunk overhead: ${needed}`);
  }
  const payloadLen = needed - 12;
  const payload = Buffer.alloc(payloadLen, 0);
  const type = Buffer.from("prVt", "ascii");
  const toCrc = Buffer.concat([type, payload]);
  const crc = zlib.crc32(toCrc);
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(payloadLen, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc, 0);
  const chunk = Buffer.concat([lenBuf, type, payload, crcBuf]);

  // Insert before IEND (which is the last 12 bytes of a valid PNG)
  const iendOffset = buf.length - 12;
  return Buffer.concat([
    buf.subarray(0, iendOffset),
    chunk,
    buf.subarray(iendOffset),
  ]);
}

export async function jpegWithExif(w: number, h: number): Promise<Buffer> {
  return sharp({
    create: {
      width: w,
      height: h,
      channels: 3,
      background: { r: 100, g: 150, b: 200 },
    },
  })
    .jpeg()
    .withExif({
      IFD0: {
        Make: "UserHQ Camera",
        Model: "Test 1",
      },
      IFD3: {
        GPSLatitudeRef: "N",
        GPSLatitude: "37/1 46/1 29/1",
      },
    })
    .toBuffer();
}

export function animatedGif(): Buffer {
  return Buffer.from(
    "47494638396102000200800000000000ffffff" +
      "21f904000a0000002c0000000002000200000202440100" +
      "21f904000a0000002c00000000020002000002024c0100" +
      "21f904000a0000002c0000000002000200000202440100" +
      "3b",
    "hex"
  );
}

export function apngFrom(png: Buffer): Buffer {
  const payload = Buffer.alloc(8);
  payload.writeUInt32BE(2, 0); // 2 frames
  payload.writeUInt32BE(0, 4); // loop forever
  const type = Buffer.from("acTL", "ascii");
  const crc = zlib.crc32(Buffer.concat([type, payload]));
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(8, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc, 0);
  const actlChunk = Buffer.concat([lenBuf, type, payload, crcBuf]);

  // Insert acTL immediately after IHDR (offset 33)
  return Buffer.concat([
    png.subarray(0, 33),
    actlChunk,
    png.subarray(33),
  ]);
}

export function svgText(): Buffer {
  return Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="40" stroke="green" stroke-width="4" fill="yellow" /></svg>'
  );
}

export function htmlAsPng(): Buffer {
  return Buffer.from("<!DOCTYPE html><html><body><h1>Fake Image</h1></body></html>");
}

export function pdfBytes(): Buffer {
  return Buffer.from(
    "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF"
  );
}

export async function pixelBombPng(): Promise<Buffer> {
  const base = await sharp({
    create: { width: 10, height: 10, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .png()
    .toBuffer();

  const bomb = Buffer.from(base);
  bomb.writeUInt32BE(8000, 16);
  bomb.writeUInt32BE(6000, 20);
  const ihdrCrc = zlib.crc32(bomb.subarray(12, 29));
  bomb.writeUInt32BE(ihdrCrc, 29);
  return bomb;
}

export async function truncatedPng(): Promise<Buffer> {
  const base = await sharp({
    create: {
      width: 100,
      height: 100,
      channels: 4,
      background: { r: 1, g: 2, b: 3, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
  return base.subarray(0, Math.floor(base.length / 2));
}
