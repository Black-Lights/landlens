// Build a GeoJSON FeatureCollection for a parcel + ownership timeline.
// Used by the sidebar Download menu and (later) bulk export.
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { ParcelExport } from './types';

export function parcelToGeoJson(p: ParcelExport): FeatureCollection {
  const feature: Feature<Geometry> = {
    type: 'Feature',
    geometry: p.geometry,
    properties: {
      id: p.id,
      khasra_no: p.khasra_no,
      area_sqm: p.area_sqm,
      area_acres: p.area_acres,
      area_hectares: p.area_hectares,
      land_type: p.land_type,
      boundary_source: p.boundary_source,
      village: p.village?.name ?? null,
      district: p.district?.name ?? null,
      state: p.state?.name ?? null,
      district_lgd: p.district?.lgd_code ?? null,
      owners: p.owners.map((o) => ({
        owner_name: o.owner_name,
        father_or_spouse: o.father_or_spouse,
        ownership_type: o.ownership_type,
        share_fraction: o.share_fraction,
        registration_date: o.registration_date,
        transfer_date: o.transfer_date,
        is_current: o.is_current,
      })),
      source: 'LandLens',
      generated_at: new Date().toISOString(),
    },
  };

  return { type: 'FeatureCollection', features: [feature] };
}
