// KML export. tokml accepts a GeoJSON FeatureCollection and emits a string
// that opens cleanly in Google Earth / mobile mapping apps.
//
// tokml has no published types so we shim the call site here.
import { parcelToGeoJson } from './geojson';
import type { ParcelExport } from './types';

const tokml = require('tokml') as (
  geojson: unknown,
  opts?: { name?: string; documentName?: string; documentDescription?: string },
) => string;

export function parcelToKml(p: ParcelExport): string {
  const fc = parcelToGeoJson(p);
  const name = p.khasra_no ? `Khasra ${p.khasra_no}` : 'LandLens parcel';
  const description = [p.village?.name, p.district?.name, p.state?.name].filter(Boolean).join(', ');
  return tokml(fc, {
    name: 'khasra_no',
    documentName: name,
    documentDescription: description || 'Exported from LandLens',
  });
}
