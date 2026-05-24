// Regenerate raster brand assets from the SVG sources in public/brand/.
// Run after any brand update: `npx tsx scripts/generate-favicons.ts`
//
// Outputs:
//   public/favicon.ico        — 16/32/48 multi-resolution ICO
//   public/apple-touch-icon.png — 180x180 PNG (iOS home screen)
//   public/brand/og-image.png — 1200x630 PNG (Open Graph / Twitter Cards)

import { promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
// `png-to-ico` ships CommonJS; the default export is the function.
import pngToIco from 'png-to-ico';

const ROOT = path.resolve(__dirname, '..');
const BRAND = path.join(ROOT, 'public', 'brand');
const PUBLIC = path.join(ROOT, 'public');

async function svgBuffer(name: string): Promise<Buffer> {
  return fs.readFile(path.join(BRAND, name));
}

// Transparent PNG rasterization. Never flatten; keep the alpha channel so the
// favicon doesn't pick up a solid background when the OS/browser composites it.
async function rasterize(svg: Buffer, size: number): Promise<Buffer> {
  return sharp(svg, { density: 384 })
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

async function generateFavicon(): Promise<void> {
  // Source the favicon from public/favicon.svg — it has no background rect, so
  // the .ico stays transparent against any browser tab/theme color. The indigo
  // app-icon.svg is reserved for the apple-touch-icon below (iOS needs opaque).
  const svg = await fs.readFile(path.join(PUBLIC, 'favicon.svg'));
  const sizes = [16, 32, 48];
  const pngs = await Promise.all(sizes.map((s) => rasterize(svg, s)));
  const ico = await pngToIco(pngs);
  await fs.writeFile(path.join(PUBLIC, 'favicon.ico'), ico);
  console.log('wrote public/favicon.ico');
}

async function generateAppleTouchIcon(): Promise<void> {
  const svg = await svgBuffer('app-icon.svg');
  const png = await rasterize(svg, 180);
  await fs.writeFile(path.join(PUBLIC, 'apple-touch-icon.png'), png);
  console.log('wrote public/apple-touch-icon.png');
}

async function generateOgImage(): Promise<void> {
  const logo = await svgBuffer('logo.svg');
  // The logo's intrinsic ratio is 240:64. Render it at 720px wide so it sits
  // comfortably centered on the 1200x630 canvas with generous whitespace.
  const logoPng = await sharp(logo, { density: 384 }).resize(720).png().toBuffer();
  const og = await sharp({
    create: { width: 1200, height: 630, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  })
    .composite([{ input: logoPng, gravity: 'center' }])
    .png()
    .toBuffer();
  await fs.writeFile(path.join(BRAND, 'og-image.png'), og);
  console.log('wrote public/brand/og-image.png');
}

async function main(): Promise<void> {
  await fs.mkdir(BRAND, { recursive: true });
  await generateFavicon();
  await generateAppleTouchIcon();
  await generateOgImage();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
