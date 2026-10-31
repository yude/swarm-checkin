interface VenueLocation {
  lat: number;
  lng: number;
  cc?: string;
  country?: string;
}

let municipalityNames: Promise<Map<string, string>> | undefined;
const resolvedMunicipalities = new Map<string, string>();

async function loadMunicipalityNames(): Promise<Map<string, string>> {
  const response = await fetch('https://maps.gsi.go.jp/js/muni.js', {
    signal: AbortSignal.timeout(3000),
  });
  if (!response.ok) throw new Error('市区町村一覧を取得できませんでした');

  // 出典: 国土地理院 https://maps.gsi.go.jp/js/muni.js
  // スクリプトは実行せず、市区町村コードと名称だけを抽出する。
  const source = await response.text();
  const names = new Map<string, string>();
  for (const match of source.matchAll(/GSI\.MUNI_ARRAY\["(\d+)"\]\s*=\s*'([^']+)'/g)) {
    const name = match[2].split(',')[3]?.replace(/[\s　]+/g, '');
    if (name) names.set(match[1].padStart(5, '0'), name);
  }
  if (names.size === 0) throw new Error('市区町村一覧の形式が不正です');
  return names;
}

export async function resolveJapaneseMunicipality(
  location: VenueLocation,
): Promise<string | null> {
  const { lat, lng, cc, country } = location;
  const isForeign = cc
    ? cc.toUpperCase() !== 'JP'
    : country && !/^(Japan|日本|日本国)$/i.test(country);
  if (isForeign) {
    return null;
  }
  if (
    !Number.isFinite(lat) || !Number.isFinite(lng) ||
    lat < 20 || lat > 46 || lng < 122 || lng > 154
  ) {
    return null;
  }

  const key = `${lat},${lng}`;
  const cached = resolvedMunicipalities.get(key);
  if (cached) return cached;

  try {
    const params = new URLSearchParams({ lat: String(lat), lon: String(lng) });
    const response = await fetch(
      `https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress?${params}`,
      { signal: AbortSignal.timeout(3000) },
    );
    if (!response.ok) return null;
    const data = await response.json();
    const code: unknown = data?.results?.muniCd;
    if (typeof code !== 'string' || !/^\d{5}$/.test(code)) return null;

    // 一覧はセッション内で共有し、失敗した場合は次回の取得で再試行する。
    municipalityNames ??= loadMunicipalityNames().catch((error) => {
      municipalityNames = undefined;
      throw error;
    });
    const name = (await municipalityNames).get(code);
    if (!name) return null;
    resolvedMunicipalities.set(key, name);
    return name;
  } catch {
    // 補完先の障害でもチェックインの共有は続けられるようにする。
    return null;
  }
}
