import { writeFile } from 'node:fs/promises';

// 出典: 国土地理院 市区町村一覧。外部スクリプトは実行しない。
const sourceUrl = 'https://maps.gsi.go.jp/js/muni.js';
const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(30_000) });
if (!response.ok) throw new Error(`市区町村一覧の取得に失敗: ${response.status}`);
const source = await response.text();
const names = {};
for (const match of source.matchAll(/GSI\.MUNI_ARRAY\["(\d+)"\]\s*=\s*'([^']+)'/g)) {
  const name = match[2].split(',')[3]?.replace(/[\s　]+/g, '');
  if (name) names[match[1].padStart(5, '0')] = name;
}
if (Object.keys(names).length < 1700) throw new Error('市区町村一覧の形式・件数を確認してください');
await writeFile(new URL('../src/data/municipalities.ts', import.meta.url),
  `// 出典: ${sourceUrl}\n// scripts/update-municipalities.mjs で更新 (${new Date().toISOString().slice(0, 10)})\nexport const municipalityNames: Record<string, string> = ${JSON.stringify(names, null, 2)};\n`);
console.log(`${Object.keys(names).length} municipalities saved`);
