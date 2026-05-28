const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? '';

type Geo = { lat: number; lng: number };

async function googleGeocode(query: string): Promise<{ geo: Geo; approximate: boolean } | null> {
  if (!GOOGLE_KEY) return null;
  const url =
    'https://maps.googleapis.com/maps/api/geocode/json' +
    '?address=' + encodeURIComponent(query + ' 台灣') +
    '&language=zh-TW&region=tw&key=' + GOOGLE_KEY;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status !== 'OK' || !data.results?.length) {
    if (data.status === 'REQUEST_DENIED') console.warn('Google Geocoding denied:', data.error_message);
    return null;
  }
  const r = data.results[0];
  return {
    geo: { lat: r.geometry.location.lat, lng: r.geometry.location.lng },
    // APPROXIMATE = Google only resolved to a city/region centroid, not the actual place.
    approximate: r.geometry.location_type === 'APPROXIMATE',
  };
}

// Address-first (most precise), then name+address, then name. A precise hit wins
// immediately; an APPROXIMATE (city-level) hit is only used if nothing better turns up.
export async function geocodePlaceName(name: string, address: string | null): Promise<Geo | null> {
  const queries = [
    address,
    address ? `${name} ${address}` : null,
    name,
  ].filter(Boolean) as string[];

  let approxFallback: Geo | null = null;
  for (const q of queries) {
    const r = await googleGeocode(q);
    if (!r) continue;
    if (!r.approximate) return r.geo;
    if (!approxFallback) approxFallback = r.geo;
  }
  return approxFallback;
}
