import sharp from "sharp";

export interface PlaceholderImage {
  data: Buffer;
  width: number;
  height: number;
  blurDataUrl: string;
}

/** Small deterministic PRNG so the same key always yields the same picture. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(text: string): number {
  let h = 2166136261;
  for (const char of text) h = Math.imul(h ^ char.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** Every third image is portrait so galleries and the lightbox get mixed aspect ratios. */
export function placeholderSize(index: number) {
  return index % 3 === 2 ? { width: 1200, height: 1500 } : { width: 1600, height: 1000 };
}

/**
 * An abstract, obviously fake "building" made of blocks over a sky gradient.
 * Deliberately has no text and no resemblance to a real project.
 */
export async function makePlaceholderImage(key: string, index: number): Promise<PlaceholderImage> {
  const { width, height } = placeholderSize(index);
  const rand = mulberry32(hash(`${key}:${index}`));
  const hue = Math.floor(rand() * 360);

  const blocks: string[] = [];
  const count = 5 + Math.floor(rand() * 4);
  for (let i = 0; i < count; i++) {
    const w = width * (0.12 + rand() * 0.22);
    const h = height * (0.25 + rand() * 0.5);
    const x = rand() * (width - w);
    const light = 18 + Math.floor(rand() * 45);
    const opacity = (0.55 + rand() * 0.4).toFixed(2);
    blocks.push(
      `<rect x="${x.toFixed(0)}" y="${(height - h).toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" fill="hsl(${hue} 12% ${light}%)" opacity="${opacity}"/>`,
    );
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="hsl(${hue} 45% 78%)"/>
      <stop offset="1" stop-color="hsl(${(hue + 30) % 360} 40% 92%)"/>
    </linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#sky)"/>
    ${blocks.join("\n")}
  </svg>`;

  const data = await sharp(Buffer.from(svg)).webp({ quality: 80 }).toBuffer();
  const blur = await sharp(data).resize(16).webp({ quality: 40 }).toBuffer();

  return { data, width, height, blurDataUrl: `data:image/webp;base64,${blur.toString("base64")}` };
}
