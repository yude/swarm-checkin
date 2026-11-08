import { municipalityNames } from '../data/municipalities.ts';

interface VenueLocation {
  lat: number;
  lng: number;
  cc?: string;
  country?: string;
}

const resolvedMunicipalities = new Map<string, string>();

export function isJapaneseLocation({ lat, lng, cc, country }: VenueLocation): boolean {
  if (cc) return cc.toUpperCase() === 'JP';
  if (country) return /^(Japan|日本|日本国)$/i.test(country);
  return lat >= 20 && lat <= 46 && lng >= 122 && lng <= 154;
}

export async function resolveJapaneseMunicipality(
  location: VenueLocation,
): Promise<string | null> {
  const { lat, lng } = location;
  if (
    !isJapaneseLocation(location) ||
    !Number.isFinite(lat) || !Number.isFinite(lng) ||
    lat < 20 || lat > 46 || lng < 122 || lng > 154
  ) {
    return null;
  }

  const key = `${lat},${lng}`;
  const cached = resolvedMunicipalities.get(key);
  if (cached) return cached;

  // 通信エラー・タイムアウト・一時的な HTTP エラーのみ一度再試行する。
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const params = new URLSearchParams({ lat: String(lat), lon: String(lng) });
      const response = await fetch(
        `https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress?${params}`,
        { signal: AbortSignal.timeout(3000) },
      );
      if (!response.ok) {
        if (response.status === 429 || response.status >= 500) continue;
        return null;
      }
      const data = await response.json();
      const code: unknown = data?.results?.muniCd;
      if (typeof code !== 'string' || !/^\d{4,5}$/.test(code)) return null;
      const name = municipalityNames[code.padStart(5, '0')];
      if (!name) return null;
      resolvedMunicipalities.set(key, name);
      return name;
    } catch {
      // 失敗はキャッシュせず、次回の取得でも再試行できるようにする。
    }
  }
  return null;
}
