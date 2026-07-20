import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getAccessToken, saveToken, validateState } from '../utils/foursquareApi';

export default function Callback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code) {
      setError('認証コードが見つかりません');
      return;
    }

    if (!state || !validateState(state)) {
      setError('無効なstateパラメータです。セキュリティのため認証を中止しました。');
      return;
    }

    getAccessToken(code)
      .then((token) => {
        saveToken(token);
        navigate('/');
      })
      .catch((err) => {
        setError(err.message || '認証に失敗しました');
      });
  }, [searchParams, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-xl shadow-sm">
          <p className="text-red-600">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-gray-500">認証中...</div>
    </div>
  );
}
