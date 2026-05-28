const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

async function nominatimSearch(query: string): Promise<{ lat: number; lng: number } | null> {
  const url = `${NOMINATIM}?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=tw`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Twogether-App/1.0' },
  });
  const data: Array<{ lat: string; lon: string }> = await res.json();
  if (data.length === 0) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

// Try name first (so the pin matches the place name the user sees),
// then name + address, then address alone.
export async function geocodePlaceName(
  name: string,
  address: string | null,
): Promise<{ lat: number; lng: number } | null> {
  const r1 = await nominatimSearch(`${name} 台灣`);
  if (r1) return r1;

  if (address) {
    const r2 = await nominatimSearch(`${name} ${address} 台灣`);
    if (r2) return r2;

    const r3 = await nominatimSearch(`${address} 台灣`);
    if (r3) return r3;
  }

  return null;
}
