const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const PROMPT =
  'This is a screenshot from Instagram or Threads showing a place (restaurant, cafe, attraction, etc.).\n' +
  'Extract the place information from the image. Keep the place name and address in their original language (Traditional Chinese if applicable).\n' +
  'Reply ONLY with this JSON format, no extra text or markdown:\n\n' +
  '{\n' +
  '  "name": "place name in original language",\n' +
  '  "category": "food|cafe|attraction|accommodation|other",\n' +
  '  "region": "north|central|south|east|unknown",\n' +
  '  "address": "full address if visible in the image, or empty string",\n' +
  '  "note": "brief description of the place"\n' +
  '}';

export type ExtractedPlace = {
  name: string;
  category: 'food' | 'cafe' | 'attraction' | 'accommodation' | 'other';
  region: string;
  address: string;
  note: string;
};

export async function extractPlaceFromScreenshot(
  base64: string,
  mimeType = 'image/jpeg',
): Promise<ExtractedPlace> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { inline_data: { mime_type: mimeType, data: base64 } },
          { text: PROMPT },
        ],
      }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const raw = (data.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim();
  const clean = raw.replace(/```json|```/g, '').trim();
  return JSON.parse(clean) as ExtractedPlace;
}
