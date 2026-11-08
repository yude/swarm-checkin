import { isJapaneseLocation, resolveJapaneseMunicipality } from './municipality.ts';

declare global {
  interface Window {
    __CONFIG__?: {
      foursquareClientId?: string;
      foursquareClientSecret?: string;
    };
  }
}

const FOURSQUARE_CLIENT_ID =
  window.__CONFIG__?.foursquareClientId ||
  import.meta.env.VITE_FOURSQUARE_CLIENT_ID ||
  '';
const FOURSQUARE_CLIENT_SECRET =
  window.__CONFIG__?.foursquareClientSecret ||
  import.meta.env.VITE_FOURSQUARE_CLIENT_SECRET ||
  '';
const FOURSQUARE_REDIRECT_URI = window.location.origin + '/callback';

export interface FoursquareCheckin {
  municipalityStatus?: 'resolved' | 'unavailable' | 'not-applicable';
  id: string;
  createdAt: number;
  venue: {
    name: string;
    location: {
      lat: number;
      lng: number;
      state?: string;
      country?: string;
      cc?: string;
      city?: string;
    };
  };
}

export function getAuthUrl(): string {
  const state = Math.random().toString(36).substring(7);
  sessionStorage.setItem('oauth_state', state);

  const params = new URLSearchParams({
    client_id: FOURSQUARE_CLIENT_ID,
    response_type: 'code',
    redirect_uri: FOURSQUARE_REDIRECT_URI,
    state: state,
  });
  return `https://foursquare.com/oauth2/authenticate?${params}`;
}

export function validateState(state: string): boolean {
  const savedState = sessionStorage.getItem('oauth_state');
  sessionStorage.removeItem('oauth_state');
  return savedState === state;
}

export async function getAccessToken(code: string): Promise<string> {
  const params = new URLSearchParams({
    client_id: FOURSQUARE_CLIENT_ID,
    client_secret: FOURSQUARE_CLIENT_SECRET,
    grant_type: 'authorization_code',
    redirect_uri: FOURSQUARE_REDIRECT_URI,
    code: code,
  });

  const response = await fetch('/oauth/foursquare/oauth2/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });

  if (!response.ok) {
    throw new Error(`アクセストークンの取得に失敗しました: ${response.status}`);
  }

  const data = await response.json();
  if (!data.access_token) {
    throw new Error('アクセストークンがレスポンスに含まれていません');
  }
  return data.access_token;
}

export async function fetchLatestCheckin(
  accessToken: string
): Promise<FoursquareCheckin | null> {
  const params = new URLSearchParams({
    oauth_token: accessToken,
    v: '20221002',
    limit: '1',
    sort: 'newestfirst',
  });

  const response = await fetch(
    `https://api.foursquare.com/v2/users/self/checkins?${params}`,
    {
      headers: { 'Accept': 'application/json' },
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`APIエラー (${response.status}): ${text.substring(0, 200)}`);
  }

  const data = await response.json();
  const items = data.response?.checkins?.items;
  if (!items || items.length === 0) {
    return null;
  }
  const checkin: FoursquareCheckin = items[0];
  const city = await resolveJapaneseMunicipality(checkin.venue.location);
  if (city) {
    checkin.venue.location.city = city;
  }
  checkin.municipalityStatus = city ? 'resolved'
    : isJapaneseLocation(checkin.venue.location) ? 'unavailable' : 'not-applicable';
  return checkin;
}

export function formatCheckinText(checkin: FoursquareCheckin): string {
  const venue = checkin.venue.name;
  const parts: string[] = [];
  if (checkin.venue.location.city) parts.push(checkin.venue.location.city);
  if (checkin.venue.location.state) parts.push(checkin.venue.location.state);
  const location = parts.join(', ') || 'unknown location';
  const url = `https://app.foursquare.com/share/checkin/${checkin.id}`;
  return `I'm at ${venue} in ${location} ${url}`;
}

export function getTweetUrl(text: string): string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
}

export function getBlueskyUrl(text: string): string {
  return `https://bsky.app/intent/compose?text=${encodeURIComponent(text)}`;
}

export function saveToken(token: string): void {
  localStorage.setItem('foursquare_token', token);
}

export function getToken(): string | null {
  return localStorage.getItem('foursquare_token');
}

export function clearToken(): void {
  localStorage.removeItem('foursquare_token');
}
