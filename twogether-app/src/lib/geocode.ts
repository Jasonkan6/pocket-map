const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? '';

type Geo = { lat: number; lng: number };

// Gemini only detects a coarse region; bias the search toward that area's main
// city so multi-branch chains resolve to the branch in the screenshot.
const REGION_CITY: Record<string, string> = {
  north: '台北',
  central: '台中',
  south: '高雄',
  east: '花蓮',
};

// Only treat an extracted "address" as a real address if it contains Taiwanese
// address markers — otherwise it's just a caption ("板橋及西門設有分店") that
// pollutes the query and makes Places match the wrong place.
const ADDRESS_MARKER = /[市區路街號鄉鎮村里巷弄段]/;

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

// Resolve a screenshot place to coordinates using Google Places Text Search —
// the same POI database behind the Google Maps app. Most precise query first:
//   1. name + real street address (only when the screenshot actually showed one)
//   2. name + the main city of the detected region (disambiguates chains)
//   3. name alone, biased to Taiwan
// Returns null when nothing is found — callers must NOT invent coordinates.
export async function geocodePlaceName(
  name: string,
  address: string | null,
  region?: string | null,
): Promise<Geo | null> {
  const queries: string[] = [];
  if (address && ADDRESS_MARKER.test(address)) queries.push(`${name} ${address}`);
  const city = region ? REGION_CITY[region] : undefined;
  if (city) queries.push(`${name} ${city}`);
  queries.push(`${name} 台灣`);

  for (const q of queries) {
    const r = await placesTextSearch(q);
    if (r) return r;
  }
  return null;
}
