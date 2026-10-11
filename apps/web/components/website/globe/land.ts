/**
 * Land shapes for the globe and the static map: world-atlas land-110m, bundled
 * at build time (no network request). Map rule: only the `land` object is ever
 * read. Country shapes and border meshes are never imported or drawn.
 */
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import land110m from "world-atlas/land-110m.json";

let cached: GeoJSON.FeatureCollection | null = null;

/** The land layer as GeoJSON, built once per page. */
export function landGeoJson(): GeoJSON.FeatureCollection {
  if (!cached) {
    const topology = land110m as unknown as Topology<{ land: GeometryCollection }>;
    cached = feature(topology, topology.objects.land);
  }
  return cached;
}
