// State-name helpers. The states GeoJSON uses `ST_NM` (e.g. "Maharashtra",
// "Tamil Nadu", "Andaman & Nicobar"). District GeoJSON files are keyed by
// the same display name with spaces preserved (e.g. "Tamil Nadu.geojson")
// so the filename is human-readable.

export function districtFilePath(stateName: string): string {
  // Just the display name as-is — fetch() URL-encodes spaces on its own.
  return `/data/boundaries/districts/${stateName}.geojson`;
}

// Slug for state subfolders / lookups that need a filesystem-safe form.
export function stateSlug(stateName: string): string {
  return stateName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
