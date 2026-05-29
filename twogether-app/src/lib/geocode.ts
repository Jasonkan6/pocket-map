const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? '';

type Geo = { lat: number; lng: number };

// Search Google's POI database by text query — same data source as typing into the Google Maps app.
async function placesTextSearch(query: string): Promise<Geo | null> {
  if (!GOOGLE_KEY) {
    console.warn('[geocode] EXPO_PUBLIC_GOOGLE_MAPS_KEY is not set');
    return null;
  }
  const url =
    'https://maps.googleapis.com/maps/api/place/textsearch/json' +
    '?query=' + encodeURIComponent(query) +
    '&region=tw&language=zh-TW&key=' + GOOGLE_KEY;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status !== 'OK' || !data.results?.length) {
    if (data.status === 'REQUEST_DENIED') console.warn('[geocode] Places API denied:', data.error_message);
    return null;
  }
  const loc = data.results[0].geometry.location;
  return { lat: loc.lat, lng: loc.lng };
}

// Resolve a place name + address to coordinates via Google Places (not Geocoding).
// Strategy mirrors the LINE bot: try address first, fall back to name.
// All queries are Taiwan-biased so multi-branch chains resolve correctly.
export async function geocodePlaceName(name: string, address: string | null): Promise<Geo | null> {
  if (address) {
    const r = await placesTextSearch(address + ' 台灣');
    if (r) return r;
  }
  return placesTextSearch(name + ' 台灣');
}
