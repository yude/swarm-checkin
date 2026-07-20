import { useState, useCallback, useEffect } from 'react';
import {
  getAuthUrl,
  getToken,
  clearToken,
  fetchLatestCheckin,
  formatCheckinText,
  getTweetUrl,
  type FoursquareCheckin,
} from './utils/foursquareApi';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(!!getToken());
  const [checkin, setCheckin] = useState<FoursquareCheckin | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setIsLoggedIn(!!getToken());
  }, []);

  const handleLogin = useCallback(() => {
    window.location.href = getAuthUrl();
  }, []);

  const handleFetch = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setError('アクセストークンがありません。再度ログインしてください。');
      return;
    }

    setIsLoading(true);
    setError(null);
    setCheckin(null);

    try {
      const latest = await fetchLatestCheckin(token);
      if (!latest) {
        setError('チェックインが見つかりませんでした。');
        return;
      }
      setCheckin(latest);
    } catch (err) {
      if (err instanceof Error && err.message.includes('401')) {
        clearToken();
        setIsLoggedIn(false);
        setError('トークンが無効です。再度ログインしてください。');
      } else {
        setError(err instanceof Error ? err.message : 'データ取得に失敗しました');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleCopy = useCallback(async () => {
    if (!checkin) return;
    const text = formatCheckinText(checkin);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('クリップボードへのコピーに失敗しました');
    }
  }, [checkin]);

  const handleLogout = useCallback(() => {
    clearToken();
    setIsLoggedIn(false);
    setCheckin(null);
    setError(null);
  }, []);

  const displayText = checkin ? formatCheckinText(checkin) : '';
  const tweetUrl = checkin ? getTweetUrl(displayText) : '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-pink-50">
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Swarm チェックイン共有</h1>
          {isLoggedIn && (
            <button
              onClick={handleLogout}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              ログアウト
            </button>
          )}
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-12">
        {!isLoggedIn ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
            <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">
              Foursquare Swarm にログイン
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              最近のチェックインを取得して、簡単に共有できます。
            </p>
            <button
              onClick={handleLogin}
              className="w-full px-6 py-3 bg-[#F94877] text-white rounded-xl hover:bg-[#e03d68] transition-colors font-medium flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-6h2v6zm4 0h-2v-6h2v6zm0-8H9V7h6v2z"/>
              </svg>
              Foursquare でログイン
            </button>
          </div>
        ) : !checkin && !isLoading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-gray-700 mb-1 font-medium">ログイン済み</p>
            <p className="text-sm text-gray-500 mb-6">
              最新のチェックインを取得します。
            </p>
            <button
              onClick={handleFetch}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
            >
              最新のチェックインを取得
            </button>
          </div>
        ) : isLoading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-700">チェックインを取得中...</p>
          </div>
        ) : checkin ? (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-sm text-gray-500">最新のチェックイン</span>
              </div>

              <p className="text-gray-900 text-lg leading-relaxed whitespace-pre-wrap break-all">
                {displayText}
              </p>
            </div>

            {error && (
              <p className="text-red-600 text-sm text-center">{error}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleCopy}
                className="flex-1 px-6 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors font-medium flex items-center justify-center gap-2"
              >
                {copied ? (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    コピーしました
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    コピー
                  </>
                )}
              </button>
              <a
                href={tweetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 px-6 py-3 bg-[#1DA1F2] text-white rounded-xl hover:bg-[#1a8cd8] transition-colors font-medium flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                X でポスト
              </a>
            </div>

            <div className="text-center">
              <button
                onClick={handleFetch}
                className="text-sm text-blue-600 hover:underline"
              >
                最新のチェックインを再取得
              </button>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

export default App;
