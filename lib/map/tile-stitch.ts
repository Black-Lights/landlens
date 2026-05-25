// Server-side static-map composer that uses MapTiler tile endpoints (free
// tier) instead of the Static Maps API (paid tier). Fetches a 2×2 grid of
// 512×512 tiles around a centre point and composites them with sharp into
// a single 1024×1024 PNG, then crops to the requested output size so the
// centre point lands at the centre of the returned image.
//
// Optionally overlays a polygon outline using an SVG layer. Polygon
// coordinates are projected into the same Web Mercator tile space so the
// overlay aligns precisely with the raster underneath.
//
// Used by:
//   - PDF "Location" image (lib/export/pdf.tsx)
//   - Dynamic per-parcel OpenGraph image (app/[locale]/parcel/[id]/opengraph-image.tsx)
//   - Saved-parcels page thumbnails via the API at /api/static-map

import sharp from 'sharp';
import type { Geometry } from 'geojson';

const TILE_SIZE = 512;
const TILE_TEMPLATE = 'https://api.maptiler.com/maps/satellite/{z}/{x}/{y}.jpg';

type StitchOptions = {
  width: number;
  height: number;
  zoom?: number;
  geometry?: Geometry | null;
};

// Web Mercator: lng/lat → fractional tile (x, y) at the given zoom.
function lngLatToTile(lng: number, lat: number, zoom: number): { x: number; y: number } {
  const n = Math.pow(2, zoom);
  const latRad = (lat * Math.PI) / 180;
  return {
    x: ((lng + 180) / 360) * n,
    y: ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
  };
}

function tileUrl(z: number, x: number, y: number, key: string): string {
  return TILE_TEMPLATE.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y)) + `?key=${key}`;
}

export async function stitchStaticMap(
  center: [number, number],
  opts: StitchOptions,
): Promise<Buffer | null> {
  const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  if (!key) return null;

  const zoom = Math.round(opts.zoom ?? 16);
  const { x: cx, y: cy } = lngLatToTile(center[0], center[1], zoom);

  // Anchor a 2×2 grid so the centre tile sits at floor(cx), floor(cy).
  const baseX = Math.floor(cx) - 1;
  const baseY = Math.floor(cy) - 1;
  const tiles: { col: number; row: number; x: number; y: number }[] = [];
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 2; col++) {
      tiles.push({ col, row, x: baseX + col + 1, y: baseY + row + 1 });
    }
  }

  // Fetch all four tiles in parallel. Any failure aborts the stitch — better
  // to return null and let the caller fall back than to ship a half-rendered
  // composite with one black quadrant.
  let tileBuffers: { col: number; row: number; buffer: Buffer }[];
  try {
    tileBuffers = await Promise.all(
      tiles.map(async (t) => {
        const res = await fetch(tileUrl(zoom, t.x, t.y, key), { cache: 'no-store' });
        if (!res.ok) throw new Error(`tile ${t.x}/${t.y} ${res.status}`);
        return { col: t.col, row: t.row, buffer: Buffer.from(await res.arrayBuffer()) };
      }),
    );
  } catch (err) {
    console.warn('[tile-stitch] tile fetch failed', err);
    return null;
  }

  const canvasW = TILE_SIZE * 2;
  const canvasH = TILE_SIZE * 2;

  // Composite the four tiles onto a transparent canvas.
  let composite = await sharp({
    create: {
      width: canvasW,
      height: canvasH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    },
  })
    .composite(
      tileBuffers.map((t) => ({
        input: t.buffer,
        top: t.row * TILE_SIZE,
        left: t.col * TILE_SIZE,
      })),
    )
    .png()
    .toBuffer();

  // The centre point on the canvas sits at the centre of the grid — but the
  // tiles round-down to whole tiles, so the actual lng/lat is offset by the
  // fractional part of (cx, cy). Compute the pixel coordinates of the centre
  // so we can crop symmetrically around it.
  const centrePxX = (cx - baseX) * TILE_SIZE;
  const centrePxY = (cy - baseY) * TILE_SIZE;

  // Optional polygon overlay via SVG.
  if (opts.geometry) {
    const svg = polygonSvg(opts.geometry, baseX, baseY, zoom, canvasW, canvasH);
    if (svg) {
      composite = await sharp(composite)
        .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
        .png()
        .toBuffer();
    }
  }

  // Crop to the requested output size, centred on the parcel.
  const left = Math.max(0, Math.min(canvasW - opts.width, Math.round(centrePxX - opts.width / 2)));
  const top = Math.max(0, Math.min(canvasH - opts.height, Math.round(centrePxY - opts.height / 2)));
  return sharp(composite)
    .extract({ left, top, width: opts.width, height: opts.height })
    .png()
    .toBuffer();
}

function polygonSvg(
  geometry: Geometry,
  baseTileX: number,
  baseTileY: number,
  zoom: number,
  width: number,
  height: number,
): string | null {
  if (geometry.type !== 'Polygon' || !geometry.coordinates?.[0]) return null;
  const ring = geometry.coordinates[0] as [number, number][];
  const pts = ring
    .map(([lng, lat]) => {
      const { x, y } = lngLatToTile(lng, lat, zoom);
      return `${((x - baseTileX) * TILE_SIZE).toFixed(2)},${((y - baseTileY) * TILE_SIZE).toFixed(2)}`;
    })
    .join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <polygon points="${pts}" fill="rgba(79,70,229,0.35)" stroke="rgb(79,70,229)" stroke-width="3"/>
  </svg>`;
}
