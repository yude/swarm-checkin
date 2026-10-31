# Swarm チェックイン共有

Foursquare Swarm の最新チェックインを取得し、共有用テキストをワンクリックでコピー / X (Twitter) にポストできる Web アプリケーション。

## 出力フォーマット

```
I'm at {スポット名} in {市町村}, {都道府県}
https://app.foursquare.com/share/checkin/{checkinId}
```

国内スポットの市区町村は、スポットの緯度・経度を使って補完します。
Foursquare の `city` に「東京」などの広域名が入っていても、千代田区などの市区町村名を表示します。
海外のスポットや補完に失敗した場合は、Foursquare の値を使用します。

市区町村の補完には[国土地理院の逆ジオコーダー](https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress)と
[市区町村一覧](https://maps.gsi.go.jp/js/muni.js)を利用し、一覧の名称から空白を除去して表示しています。
スポットの座標のみを国土地理院へ送信します。各リクエストのタイムアウトは3秒です。
同じ座標の補完結果と市区町村一覧は、ページを開いている間キャッシュします。

## テスト

Node.js 24 で `npm test` を実行すると、市区町村の補完と共有文の回帰テストを実行できます。

## 技術スタック

- React 19 + TypeScript
- Vite
- Tailwind CSS v4
- Nginx（本番環境）

## セットアップ

### Foursquare API 設定

1. [Foursquare Developer Portal](https://developer.foursquare.com/) でアプリを登録
2. Redirect URI(s) に使う環境のものを全て登録（複数登録可能）:
   - 開発: `http://localhost:5173/callback`
   - Docker Compose: `http://localhost:8080/callback`
   - 本番: `https://your-domain.example.com/callback`

   アプリケーションはアクセス元のオリジンに自動的に合わせて `{origin}/callback` にリダイレクトします。
3. `.env` ファイルを作成:

```bash
cp .env.example .env
```

4. `.env` にクライアント ID とシークレットを設定:

```
VITE_FOURSQUARE_CLIENT_ID=your_client_id
VITE_FOURSQUARE_CLIENT_SECRET=your_client_secret
```

### 開発サーバ

```bash
npm install
npm run dev
```

## ビルド・デプロイ

### ローカルビルド

```bash
npm run build
```

### Docker

```bash
docker build -t ghcr.io/yude/swarm-checkin:latest .

docker run -p 8080:80 \
  -e VITE_FOURSQUARE_CLIENT_ID=xxx \
  -e VITE_FOURSQUARE_CLIENT_SECRET=xxx \
  ghcr.io/yude/swarm-checkin:latest
```

### Docker Compose

```bash
# .env ファイルに認証情報を設定
docker compose up --build
```

### Kubernetes (Kustomize)

Secret を作成後、デプロイ:

```bash
# Secret を作成（実際の値に置き換え）
kubectl create secret generic foursquare-credentials \
  --from-literal=client-id=YOUR_CLIENT_ID \
  --from-literal=client-secret=YOUR_CLIENT_SECRET \
  -n swarm-checkin

# 開発環境
kubectl apply -k k8s/overlays/development

# 本番環境
kubectl apply -k k8s/overlays/production
```

Secret は Pod 起動時に環境変数として注入され、Nginx が `envsubst` で `/config.js` を動的に生成します。

### GitHub Actions

main ブランチへの push または `v*` タグで自動的にイメージがビルド・プッシュされます。
認証情報はビルド時には埋め込まれず、ランタイムの環境変数として注入されます。

## ライセンス

MIT
