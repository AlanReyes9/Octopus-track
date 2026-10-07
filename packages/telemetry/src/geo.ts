/** Precisión de almacenamiento: DECIMAL(10, 7). */
export const COORD_SCALE = 7;

export function roundCoord(value: number): number {
  const f = 10 ** COORD_SCALE;
  return Math.round(value * f) / f;
}

/** Representación exacta en texto para columnas DECIMAL(10,7). */
export function coordToDecimal(value: number): string {
  return value.toFixed(COORD_SCALE);
}

export function isValidLatitude(lat: number): boolean {
  return Number.isFinite(lat) && lat >= -90 && lat <= 90;
}

export function isValidLongitude(lon: number): boolean {
  return Number.isFinite(lon) && lon >= -180 && lon <= 180;
}

export const KNOTS_TO_KMH = 1.852;

const EARTH_RADIUS_M = 6_371_008.8;

/** Distancia ortodrómica en metros. */
export function haversineMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function pathLengthMeters(points: { latitude: number; longitude: number }[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += haversineMeters(points[i - 1]!, points[i]!);
  return total;
}
