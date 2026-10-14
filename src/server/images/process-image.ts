import sharp from "sharp";
import { IMAGE_LIMITS } from "@/lib/image-rules";

export interface ProcessedImage {
  data: Buffer;
  width: number;
  height: number;
  blurDataUrl: string;
}

export class ImageRejected extends Error {}

const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp", "avif"]);

/**
 * Turns an untrusted upload into the one thing the site stores: a WebP no larger than maxSide.
 * The format is read from the bytes, never from the file name or the browser's claim. Re-encoding
 * drops everything that is not pixels (EXIF location, embedded profiles, appended data), and the
 * orientation is applied first so rotated phone photos stay upright. Throws ImageRejected, with a
 * message safe to show the admin, for anything that is not a usable image.
 */
export async function processImage(input: Buffer): Promise<ProcessedImage> {
  if (input.length === 0) throw new ImageRejected("The file is empty.");
  if (input.length > IMAGE_LIMITS.maxBytes) throw new ImageRejected("The file is larger than 30 MB.");

  try {
    const probe = sharp(input, { limitInputPixels: IMAGE_LIMITS.maxPixels });
    const meta = await probe.metadata();
    // sharp reports AVIF as "heif" with AV1 compression; HEIC (HEVC) is a different, unwanted format.
    const isAvif = meta.format === "heif" && meta.compression === "av1";
    if (!meta.format || !(ALLOWED_FORMATS.has(meta.format) || isAvif)) {
      throw new ImageRejected("Only JPEG, PNG, WebP and AVIF images are accepted.");
    }
    if (!meta.width || !meta.height) throw new ImageRejected("The image has no readable size.");

    const { data, info } = await sharp(input, { limitInputPixels: IMAGE_LIMITS.maxPixels })
      .rotate()
      .resize({
        width: IMAGE_LIMITS.maxSide,
        height: IMAGE_LIMITS.maxSide,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });

    const blur = await sharp(data).resize(16).webp({ quality: 40 }).toBuffer();
    return {
      data,
      width: info.width,
      height: info.height,
      blurDataUrl: `data:image/webp;base64,${blur.toString("base64")}`,
    };
  } catch (error) {
    if (error instanceof ImageRejected) throw error;
    throw new ImageRejected("That file could not be read as an image. It may be damaged.");
  }
}
