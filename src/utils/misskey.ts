export const DEFAULT_MISSKEY_DOMAIN = 'misskey.io';
const STORAGE_KEY = 'misskey_instance_domain';

export function normalizeMisskeyDomain(value: string): string {
  const domain = value.trim().replace(/^https:\/\//i, '').replace(/\/$/, '').toLowerCase();
  const labels = domain.split('.');
  if (domain.length > 253 || labels.length < 2 || labels.some(
    label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label),
  )) {
    throw new Error('インスタンスのドメインを入力してください（例: misskey.io）。');
  }
  return domain;
}

export function getMisskeyDomain(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? normalizeMisskeyDomain(saved) : DEFAULT_MISSKEY_DOMAIN;
  } catch {
    return DEFAULT_MISSKEY_DOMAIN;
  }
}

export function saveMisskeyDomain(value: string): string {
  const domain = normalizeMisskeyDomain(value);
  try {
    localStorage.setItem(STORAGE_KEY, domain);
  } catch {
    throw new Error('設定を保存できませんでした。ブラウザのストレージ設定を確認してください。');
  }
  return domain;
}

export function getMisskeyShareUrl(text: string, domain: string): string {
  return `https://${normalizeMisskeyDomain(domain)}/share?text=${encodeURIComponent(text)}`;
}
