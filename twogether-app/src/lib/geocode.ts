const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? '';

export type GeoResult = {
  lat: number;
  lng: number;
  placeId: string;
};

// Search Google's POI database — same source as typing into the Google Maps app.
async function placesTextSearch(query: string): Promise<GeoResult | null> {
  if (!GOOGLE_KEY) {
    console.warn('[geocode] ❌ EXPO_PUBLIC_GOOGLE_MAPS_KEY is not set — cannot geocode');
    return null;
  }
  const url =
    'https://maps.googleapis.com/maps/api/place/textsearch/json' +
    '?query=' + encodeURIComponent(query) +
    '&region=tw&language=zh-TW&key=' + GOOGLE_KEY;

  console.log('[geocode] 🔍 query:', query);
  const res = await fetch(url);
  const data = await res.json();
  console.log('[geocode] status:', data.status, '| results:', data.results?.length ?? 0,
    data.error_message ? '| error: ' + data.error_message : '');

  if (data.status !== 'OK' || !data.results?.length) return null;
  const r = data.results[0];
  console.log('[geocode] ✅', r.name, r.geometry.location.lat, r.geometry.location.lng, '| placeId:', r.place_id);
  return { lat: r.geometry.location.lat, lng: r.geometry.location.lng, placeId: r.place_id };
}

// Try address first (more specific), then name. Both are Taiwan-biased.
export async function geocodePlaceName(name: string, address: string | null): Promise<GeoResult | null> {
  if (address) {
    const r = await placesTextSearch(address + ' 台灣');
    if (r) return r;
  }
  return placesTextSearch(name + ' 台灣');
}
