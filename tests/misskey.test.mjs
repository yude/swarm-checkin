import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { getMisskeyDomain, saveMisskeyDomain, normalizeMisskeyDomain, getMisskeyShareUrl } from '../src/utils/misskey.ts';

let storage;
beforeEach(() => {
  storage = new Map();
  globalThis.localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  };
});

test('初期値は misskey.io で、設定したドメインを再取得できる', () => {
  assert.equal(getMisskeyDomain(), 'misskey.io');
  assert.equal(saveMisskeyDomain(' https://Misskey.Y2E.org/ '), 'misskey.y2e.org');
  assert.equal(getMisskeyDomain(), 'misskey.y2e.org');
});

test('両インスタンスに共有文を欠けずに渡す', () => {
  const text = "I'm at 日高屋 in 千代田区, 東京都 https://app.foursquare.com/share/checkin/test & #日本 + ☕\n続き";
  for (const domain of ['misskey.io', 'misskey.y2e.org']) {
    const url = new URL(getMisskeyShareUrl(text, domain));
    assert.equal(url.origin, `https://${domain}`);
    assert.equal(url.pathname, '/share');
    assert.equal(url.searchParams.get('text'), text);
    assert.equal(url.searchParams.size, 1);
  }
});

test('ドメイン以外は保存せず、既存設定を保持する', () => {
  saveMisskeyDomain('misskey.y2e.org');
  for (const value of ['', 'localhost', 'javascript:alert(1)', 'http://misskey.io',
    'misskey.io/share', 'misskey.io?text=other', 'misskey.io#fragment',
    'user@misskey.io', 'misskey.io:443', 'misskey..io', '-misskey.io',
    'misskey-.io', 'miss key.io', `${'a'.repeat(64)}.io`]) {
    assert.throws(() => normalizeMisskeyDomain(value));
    assert.throws(() => saveMisskeyDomain(value));
    assert.equal(getMisskeyDomain(), 'misskey.y2e.org');
  }
});

test('不正な保存値・ストレージ読込失敗は初期値を使い、保存失敗は通知する', () => {
  storage.set('misskey_instance_domain', 'javascript:alert(1)');
  assert.equal(getMisskeyDomain(), 'misskey.io');
  globalThis.localStorage = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
  };
  assert.equal(getMisskeyDomain(), 'misskey.io');
  assert.throws(() => saveMisskeyDomain('misskey.y2e.org'), /設定を保存できませんでした/);
});
