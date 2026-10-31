import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

const names = `
GSI.MUNI_ARRAY = {};
GSI.MUNI_ARRAY["13101"] = '13,東京都,13101,千代田区';
GSI.MUNI_ARRAY["1102"] = '1,北海道,1102,札幌市　北区';
GSI.MUNI_ARRAY["13303"] = '13,東京都,13303,瑞穂町';
GSI.MUNI_ARRAY["47353"] = '47,沖縄県,47353,渡嘉敷村';
`;
let moduleId = 0;
async function resolver() {
  return (await import(`../src/utils/municipality.ts?test=${moduleId++}`)).resolveJapaneseMunicipality;
}

for (const [code, expected] of [
  ['13101', '千代田区'],
  ['01102', '札幌市北区'],
  ['13303', '瑞穂町'],
  ['47353', '渡嘉敷村'],
]) {
  test(`市区町村コード ${code} を ${expected} に変換する`, async () => {
    const resolve = await resolver();
    globalThis.fetch = async (url, options) => {
      assert.ok(options.signal instanceof AbortSignal);
      if (url.endsWith('/muni.js')) return new Response(names);
      const params = new URL(url).searchParams;
      assert.equal(params.get('lat'), '35.681236');
      assert.equal(params.get('lon'), '139.767125');
      return Response.json({ results: { muniCd: code, lv01Nm: '丸の内一丁目' } });
    };
    assert.equal(await resolve({ lat: 35.681236, lng: 139.767125, cc: 'JP' }), expected);
  });
}

test('同じ座標の結果と市区町村一覧をキャッシュする', async () => {
  const resolve = await resolver();
  let reverseCalls = 0;
  let namesCalls = 0;
  globalThis.fetch = async (url) => {
    if (url.endsWith('/muni.js')) {
      namesCalls++;
      return new Response(names);
    }
    reverseCalls++;
    return Response.json({ results: { muniCd: '13101' } });
  };
  const location = { lat: 35.68, lng: 139.76, country: '日本' };
  assert.equal(await resolve(location), '千代田区');
  assert.equal(await resolve(location), '千代田区');
  assert.equal(await resolve({ ...location, lat: 35.69 }), '千代田区');
  assert.equal(reverseCalls, 2);
  assert.equal(namesCalls, 1);
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
    globalThis.fetch = async (url) => url.endsWith('/muni.js')
      ? new Response(names) : Response.json(response);
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

test('市区町村一覧の失敗・形式変更後、次の取得で再試行する', async () => {
  const resolve = await resolver();
  let namesCalls = 0;
  globalThis.fetch = async (url) => {
    if (!url.endsWith('/muni.js')) return Response.json({ results: { muniCd: '13101' } });
    namesCalls++;
    if (namesCalls === 1) return new Response('', { status: 503 });
    if (namesCalls === 2) return new Response('changed format');
    return new Response(names);
  };
  const location = { lat: 35.68, lng: 139.76 };
  assert.equal(await resolve(location), null);
  assert.equal(await resolve(location), null);
  assert.equal(await resolve(location), '千代田区');
  assert.equal(namesCalls, 3);
});

test('最新チェックインの取得から共有文・X 投稿まで市区町村を反映する', async () => {
  globalThis.window = {
    __CONFIG__: { foursquareClientId: 'test-id', foursquareClientSecret: 'test-secret' },
    location: { origin: 'https://example.com' },
  };
  const { fetchLatestCheckin, formatCheckinText, getTweetUrl } = await import('../src/utils/foursquareApi.ts');
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
    if (url.endsWith('/muni.js')) return new Response(names);
    return Response.json({ results: { muniCd: '13101' } });
  };
  const result = await fetchLatestCheckin('private-token');
  const text = formatCheckinText(result);
  assert.equal(text, "I'm at 東京駅 in 千代田区, 東京都 https://app.foursquare.com/share/checkin/test-checkin");
  assert.equal(new URL(getTweetUrl(text)).searchParams.get('text'), text);

  reverseFails = true;
  checkin.venue.location.lat = 35.681;
  const fallback = await fetchLatestCheckin('private-token');
  assert.equal(fallback.venue.location.city, '東京');
  assert.equal(fallback.venue.location.state, '東京都');
});
