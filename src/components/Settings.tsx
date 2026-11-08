import { useState } from 'react';
import { saveMisskeyDomain } from '../utils/misskey';

interface SettingsProps {
  misskeyDomain: string;
  onSave: (domain: string) => void;
  onCancel: () => void;
}

export default function Settings({ misskeyDomain, onSave, onCancel }: SettingsProps) {
  const [domain, setDomain] = useState(misskeyDomain);
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-6">設定</h2>
      <form onSubmit={event => {
        event.preventDefault();
        try {
          const saved = saveMisskeyDomain(domain);
          onSave(saved);
        } catch (err) {
          setError(err instanceof Error ? err.message : '設定を保存できませんでした。');
        }
      }}>
        <label htmlFor="misskey-domain" className="block text-sm font-medium text-gray-900 mb-2">
          Misskey の投稿先インスタンス
        </label>
        <input
          id="misskey-domain"
          type="text"
          value={domain}
          onChange={event => { setDomain(event.target.value); setError(null); }}
          placeholder="misskey.io"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          aria-invalid={!!error}
          aria-describedby={error ? 'misskey-help misskey-error' : 'misskey-help'}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
        />
        <p id="misskey-help" className="text-sm text-gray-500 mt-2">
          設定はこのブラウザに保存されます。
        </p>
        {error && <p id="misskey-error" role="alert" className="text-red-600 text-sm mt-2">{error}</p>}
        <div className="flex gap-3 mt-6">
          <button type="submit" className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">保存</button>
          <button type="button" onClick={onCancel} className="px-5 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">キャンセル</button>
        </div>
      </form>
    </section>
  );
}
