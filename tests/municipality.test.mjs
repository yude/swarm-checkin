import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

let moduleId = 0;
async function resolver() {
  return (await import(`../src/utils/municipality.ts?test=${moduleId++}`)).resolveJapaneseMunicipality;
}

for (const [code, expected] of [
  ['13101', '千代田区'],
  ['01102', '札幌市北区'],
  ['1102', '札幌市北区'],
  ['13303', '瑞穂町'],
  ['47353', '渡嘉敷村'],
]) {
  test(`市区町村コード ${code} を ${expected} に変換する`, async () => {
    const resolve = await resolver();
    globalThis.fetch = async (url, options) => {
      assert.ok(options.signal instanceof AbortSignal);
      assert.ok(!url.endsWith('/muni.js'));
      const params = new URL(url).searchParams;
      assert.equal(params.get('lat'), '35.681236');
      assert.equal(params.get('lon'), '139.767125');
      return Response.json({ results: { muniCd: code, lv01Nm: '丸の内一丁目' } });
    };
    assert.equal(await resolve({ lat: 35.681236, lng: 139.767125, cc: 'JP' }), expected);
  });
}

test('市区町村一覧の追加通信なしで同じ座標の結果をキャッシュする', async () => {
  const resolve = await resolver();
  let reverseCalls = 0;
  globalThis.fetch = async (url) => {
    assert.ok(!url.endsWith('/muni.js'));
    reverseCalls++;
    return Response.json({ results: { muniCd: '13101' } });
  };
  const location = { lat: 35.68, lng: 139.76, country: '日本' };
  assert.equal(await resolve(location), '千代田区');
  assert.equal(await resolve(location), '千代田区');
  assert.equal(await resolve({ ...location, lat: 35.69 }), '千代田区');
  assert.equal(reverseCalls, 2);
});

test('海外・不正な座標は問い合わせない', async () => {
  const resolve = await resolver();
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({}); };
  for (const location of [
    { lat: 35.68, lng: 139.76, cc: 'US' },
    { lat: 35.68, lng: 139.76, country: 'South Korea' },
    { lat: 40.71, lng: -74.01 },
    { lat: NaN, lng: 139.76 },
    { lat: 35.68, lng: Infinity },
    { lat: undefined, lng: undefined },
    { lat: 0, lng: 0 },
  ]) assert.equal(await resolve(location), null);
  assert.equal(calls, 0);
});

for (const [label, response] of [
  ['海上など結果なし', {}],
  ['null 応答', null],
  ['不正なコード', { results: { muniCd: {} } }],
  ['未知のコード', { results: { muniCd: '99999' } }],
]) {
  test(`${label} は補完しない`, async () => {
    const resolve = await resolver();
    globalThis.fetch = async () => Response.json(response);
    assert.equal(await resolve({ lat: 35.68, lng: 139.76 }), null);
  });
}

for (const [label, response] of [
  ['HTTP エラー', () => new Response('', { status: 503 })],
  ['不正な JSON', () => new Response('invalid')],
  ['タイムアウト', () => { throw new DOMException('Timed out', 'TimeoutError'); }],
]) {
  test(`${label} でもチェックイン取得を妨げない`, async () => {
    const resolve = await resolver();
    globalThis.fetch = async () => response();
    assert.equal(await resolve({ lat: 35.68, lng: 139.76 }), null);
  });
}

for (const [label, fail] of [
  ['HTTP 503', () => new Response('', { status: 503 })],
  ['HTTP 429', () => new Response('', { status: 429 })],
  ['ネットワーク障害', () => { throw new TypeError('Failed to fetch'); }],
  ['タイムアウト', () => { throw new DOMException('Timed out', 'TimeoutError'); }],
]) {
  test(`${label} の次の試行で市区町村を取得する`, async () => {
    const resolve = await resolver();
    let calls = 0;
    globalThis.fetch = async () => ++calls === 1
      ? fail() : Response.json({ results: { muniCd: '13101' } });
    assert.equal(await resolve({ lat: 35.68, lng: 139.76, cc: 'JP' }), '千代田区');
    assert.equal(calls, 2);
  });
}

test('再試行回数は有限で、失敗後も次の取得で復旧する', async () => {
  const resolve = await resolver();
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response('', { status: 503 });
  };
  const location = { lat: 35.68, lng: 139.76, cc: 'JP' };
  assert.equal(await resolve(location), null);
  assert.equal(calls, 2);
  globalThis.fetch = async () => Response.json({ results: { muniCd: '13101' } });
  assert.equal(await resolve(location), '千代田区');
});

test('HTTP 400 や該当なしは再試行しない', async () => {
  for (const response of [new Response('', { status: 400 }), Response.json({})]) {
    const resolve = await resolver();
    let calls = 0;
    globalThis.fetch = async () => { calls++; return response; };
    assert.equal(await resolve({ lat: 35.68, lng: 139.76 }), null);
    assert.equal(calls, 1);
  }
});

test('最新チェックインの取得から共有文・X・Bluesky 投稿まで市区町村を反映する', async () => {
  globalThis.window = {
    __CONFIG__: { foursquareClientId: 'test-id', foursquareClientSecret: 'test-secret' },
    location: { origin: 'https://example.com' },
  };
  const { fetchLatestCheckin, formatCheckinText, getTweetUrl, getBlueskyUrl } = await import('../src/utils/foursquareApi.ts');
  const checkin = {
    id: 'test-checkin', createdAt: 0,
    venue: { name: '東京駅', location: { lat: 35.681236, lng: 139.767125, cc: 'JP', city: '東京', state: '東京都' } },
  };
  let reverseFails = false;
  globalThis.fetch = async (url) => {
    if (url.startsWith('https://api.foursquare.com/')) {
      return Response.json({ response: { checkins: { items: [checkin] } } });
    }
    // Foursquare の認証情報を外部の補完先へ送らない。
    assert.ok(!url.includes('private-token'));
    if (reverseFails) return new Response('', { status: 503 });
    assert.ok(!url.endsWith('/muni.js'));
    return Response.json({ results: { muniCd: '13101' } });
  };
  const result = await fetchLatestCheckin('private-token');
  assert.equal(result.municipalityStatus, 'resolved');
  const text = formatCheckinText(result);
  assert.equal(text, "I'm at 東京駅 in 千代田区, 東京都 https://app.foursquare.com/share/checkin/test-checkin");
  assert.equal(new URL(getTweetUrl(text)).searchParams.get('text'), text);
  const bluesky = new URL(getBlueskyUrl(text));
  assert.equal(bluesky.origin + bluesky.pathname, 'https://bsky.app/intent/compose');
  assert.equal(bluesky.searchParams.get('text'), text);
  const specialText = text + ' & #渋谷 + ☕\n日本語';
  assert.equal(new URL(getBlueskyUrl(specialText)).searchParams.get('text'), specialText);

  reverseFails = true;
  checkin.venue.location.lat = 35.681;
  const fallback = await fetchLatestCheckin('private-token');
  assert.equal(fallback.municipalityStatus, 'unavailable');
  assert.equal(fallback.venue.location.city, '東京');
  assert.equal(fallback.venue.location.state, '東京都');
});
