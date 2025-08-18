// Pure vector math utils
export function dot(a: number[], b: number[]): number {
  return a.reduce((sum, v, i) => sum + v * b[i], 0);
}
export function norm(a: number[]): number {
  return Math.sqrt(dot(a, a));
}
export function normalize(a: number[]): number[] {
  const n = norm(a);
  return n > 1e-9 ? a.map(x => x / n) : a.slice();
}
export function cosSim(a: number[], b: number[]): number {
  return dot(a, b) / ((norm(a) * norm(b)) || 1);
}
// Haversine distance in km
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
