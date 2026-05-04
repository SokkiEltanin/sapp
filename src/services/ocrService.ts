import * as FileSystem from 'expo-file-system/legacy';

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_VISION_API_KEY ?? '';
const ENDPOINT = 'https://vision.googleapis.com/v1/images:annotate';

export async function extractTextFromImage(imageUri: string): Promise<string> {
  if (!API_KEY) {
    throw new Error('Brak klucza API — dodaj EXPO_PUBLIC_GOOGLE_VISION_API_KEY do pliku .env');
  }

  const base64 = await FileSystem.readAsStringAsync(imageUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const body = {
    requests: [{
      image: { content: base64 },
      features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }],
      imageContext: { languageHints: ['pl', 'en'] },
    }],
  };

  const res = await fetch(`${ENDPOINT}?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error?.message ?? 'OCR nie powiodło się');
  }

  const text: string = data.responses?.[0]?.fullTextAnnotation?.text ?? '';
  if (!text) throw new Error('Nie rozpoznano tekstu na zdjęciu — spróbuj wyraźniejsze zdjęcie');

  return text;
}
