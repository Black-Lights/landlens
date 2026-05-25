// PDF report — one-page summary of a parcel for download.
// Rendered via @react-pdf/renderer on the server (Node runtime).
//
// Layout: logo + title at the top, attribute table, ownership timeline, a
// MapTiler static-map snapshot, footer with source attribution + date.

import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import type { ParcelExport } from './types';
import { stitchStaticMap } from '@/lib/map/tile-stitch';

// Pre-fetched static map. react-pdf in the Node runtime is unreliable at
// fetching remote images during PDF assembly (timeouts and quiet failures
// produce the broken-image placeholder), so the route handler fetches the
// PNG and hands us a Buffer + format. When `mapImage` is null we just skip
// the map section instead of rendering the placeholder tile.
export interface PdfMapImage {
  data: Buffer;
  format: 'png' | 'jpg';
}

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: 'Helvetica', color: '#0f172a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  brand: { fontSize: 16, fontWeight: 700, color: '#4F46E5' },
  tagline: { fontSize: 8, color: '#64748b' },
  title: { fontSize: 20, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 10, color: '#475569', marginBottom: 14 },
  sectionTitle: { fontSize: 11, fontWeight: 700, marginBottom: 6, color: '#334155', textTransform: 'uppercase', letterSpacing: 0.5 },
  table: { borderTop: '1pt solid #e2e8f0', marginBottom: 14 },
  row: { flexDirection: 'row', borderBottom: '1pt solid #e2e8f0', paddingVertical: 5 },
  cellLabel: { width: 130, color: '#64748b' },
  cellValue: { flex: 1, color: '#0f172a' },
  ownerRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottom: '1pt solid #e2e8f0' },
  ownerName: { fontWeight: 700 },
  ownerMeta: { color: '#64748b', fontSize: 9 },
  badge: { backgroundColor: '#4F46E5', color: '#fff', fontSize: 8, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4 },
  map: { width: '100%', height: 200, marginVertical: 12, borderRadius: 6, objectFit: 'cover' },
  footer: { marginTop: 18, paddingTop: 10, borderTop: '1pt solid #e2e8f0', fontSize: 8, color: '#64748b' },
});

export function ParcelReport({
  parcel,
  mapImage = null,
}: {
  parcel: ParcelExport;
  mapImage?: PdfMapImage | null;
}) {
  const breadcrumb = [parcel.village?.name, parcel.district?.name, parcel.state?.name]
    .filter(Boolean)
    .join(' · ');

  return (
    <Document title={`LandLens — Khasra ${parcel.khasra_no ?? parcel.id}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>LandLens</Text>
            <Text style={styles.tagline}>See every inch of India&apos;s land</Text>
          </View>
          <Text style={styles.tagline}>Generated {formatDate(new Date())}</Text>
        </View>

        <Text style={styles.title}>Khasra {parcel.khasra_no ?? '—'}</Text>
        <Text style={styles.subtitle}>{breadcrumb}</Text>

        <Text style={styles.sectionTitle}>Parcel details</Text>
        <View style={styles.table}>
          <KV label="Area (acres)" value={parcel.area_acres.toFixed(3)} />
          <KV label="Area (hectares)" value={parcel.area_hectares.toFixed(3)} />
          <KV label="Area (sq m)" value={Math.round(parcel.area_sqm).toLocaleString('en-IN')} />
          <KV label="Land type" value={parcel.land_type ?? '—'} />
          <KV label="Boundary source" value={parcel.boundary_source} />
          {parcel.district?.lgd_code && (
            <KV label="District LGD code" value={parcel.district.lgd_code} />
          )}
        </View>

        {mapImage && (
          <>
            <Text style={styles.sectionTitle}>Location</Text>
            {/* react-pdf accepts an in-memory buffer here, avoiding any
                runtime image-fetch dance. The route handler pre-fetched the
                PNG with the parcel outline already overlaid. */}
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={mapImage} style={styles.map} />
          </>
        )}

        <Text style={styles.sectionTitle}>Ownership timeline</Text>
        {parcel.owners.length === 0 ? (
          <Text style={{ color: '#64748b', fontSize: 9 }}>No ownership records on file.</Text>
        ) : (
          parcel.owners.map((o) => (
            <View key={o.id} style={styles.ownerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.ownerName}>{o.owner_name}</Text>
                <Text style={styles.ownerMeta}>
                  {o.father_or_spouse ? `S/o · D/o · W/o ${o.father_or_spouse}` : ''}
                  {o.share_fraction ? `  ·  Share ${o.share_fraction}` : ''}
                  {o.registration_date ? `  ·  Registered ${o.registration_date}` : ''}
                </Text>
              </View>
              {o.is_current && <Text style={styles.badge}>Current</Text>}
            </View>
          ))
        )}

        <View style={styles.footer}>
          <Text>
            Source: LandLens — derived from public state portal data + community contributions. This is
            an informational summary, not a certified land record. For legal purposes, consult the
            official Record of Rights from your state revenue department.
          </Text>
        </View>
      </Page>
    </Document>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.cellLabel}>{label}</Text>
      <Text style={styles.cellValue}>{value}</Text>
    </View>
  );
}

export function centroidOf(parcel: ParcelExport): [number, number] | null {
  const g = parcel.geometry;
  if (g.type !== 'Polygon' || !g.coordinates?.[0]) return null;
  const ring = g.coordinates[0] as [number, number][];
  let lngSum = 0;
  let latSum = 0;
  // Last point repeats the first; skip it for averaging.
  const count = ring.length - 1;
  for (let i = 0; i < count; i++) {
    lngSum += ring[i][0];
    latSum += ring[i][1];
  }
  return [lngSum / count, latSum / count];
}

// Builds the PDF "Location" image by stitching MapTiler satellite tiles —
// the Static Maps API isn't on our plan, but the tile endpoints work on the
// free tier. Falls back to no image when the key is missing or all four
// tiles fail.
export async function fetchPdfMapImage(parcel: ParcelExport): Promise<PdfMapImage | null> {
  const center = centroidOf(parcel);
  if (!center) return null;
  const buffer = await stitchStaticMap(center, {
    width: 800,
    height: 480,
    zoom: 16,
    geometry: parcel.geometry,
  });
  if (!buffer) return null;
  return { data: buffer, format: 'png' };
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
