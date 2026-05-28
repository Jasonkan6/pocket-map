const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? '';

type Geo = { lat: number; lng: number };

async function placesTextSearch(query: string): Promise<Geo | null> {
  if (!GOOGLE_KEY) return null;
  const url =
    'https://maps.googleapis.com/maps/api/place/textsearch/json' +
    '?query=' + encodeURIComponent(query) +
    '&region=tw&language=zh-TW&key=' + GOOGLE_KEY;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status !== 'OK' || !data.results?.length) {
    if (data.status === 'REQUEST_DENIED') console.warn('Google Places denied:', data.error_message);
    return null;
  }
  const loc = data.results[0].geometry.location;
  return { lat: loc.lat, lng: loc.lng };
}

// Try name+address first (most specific), then name-only fallback.
// Places Text Search queries Google's POI database directly, so it works
// even when the screenshot only shows a neighbourhood or vague area.
export async function geocodePlaceName(name: string, address: string | null): Promise<Geo | null> {
  if (address) {
    const result = await placesTextSearch(`${name} ${address}`);
    if (result) return result;
  }
  return placesTextSearch(`${name} 台灣`);
}
