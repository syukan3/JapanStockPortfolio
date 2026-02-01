# JapanStockPortfolio

日本株ポートフォリオ管理 Web アプリケーション。保有銘柄・取引履歴・損益・セクター配分をダッシュボードで可視化。

## リポジトリ構成

JapanStockPortfolio は、3つのリポジトリで構成される **JapanStock** プロジェクトの一部です。

```
JapanStock/
├── JapanStockDataPipeline/   Public   データパイプライン（DB所有・マイグレーション管理）
├── JapanStockPortfolio/      Public   ポートフォリオ管理 ← このリポジトリ
└── JapanStockScouter/        Private  スクリーニング・分析
```

### 共有データベース

3つのリポジトリは **同一の Supabase データベース** を共有しています。

- **スキーマ管理・マイグレーション**: [JapanStockDataPipeline](https://github.com/m-sakae/JapanStockDataPipeline) が一元管理
- **データ投入**: JapanStockDataPipeline の Cron ジョブが J-Quants API からデータを取得・格納
- **データ参照**: JapanStockPortfolio は `jquants_core` スキーマの株価・銘柄データを読み取り専用で利用
- **結果書き込み**: ポートフォリオ・取引・配当・設定は自身の `portfolio` スキーマに書き込み

```
┌─────────────────────────────────────────────────────┐
│                   Supabase (PostgreSQL)              │
│                                                     │
│  jquants_core     データパイプラインが管理する共有データ   │
│  portfolio        ポートフォリオ管理（本リポジトリ）       │
└─────────────────────────────────────────────────────┘
        ▲ 読み取り              ▲ 読み書き
        │                      │
   JapanStockPortfolio ────────┘
```

## 機能

| 機能 | 説明 |
|------|------|
| 認証 | メール+パスワード（サインアップ・ログイン・パスワードリセット） |
| ポートフォリオ管理 | 複数ポートフォリオ作成・編集・削除（NISA成長/積立、特定、一般） |
| 取引登録 | 売買取引の記録（銘柄オートコンプリート付き） |
| ダッシュボード | サマリカード（時価総額・含み損益・日次変動）、保有銘柄テーブル、セクター円グラフ |
| 銘柄詳細 | ローソク足チャート、PER/PBR/ROE/配当利回り、決算発表スケジュール（認証不要） |
| 設定 | デフォルトポートフォリオ、原価計算方式（平均法/FIFO） |

## プロジェクト構成

```
app/
├── (auth)/                  認証ページ（login, signup, reset-password）
├── (protected)/             認証必須ページ
│   ├── dashboard/           ダッシュボード（Suspense 並列ストリーミング）
│   ├── portfolios/          ポートフォリオ一覧・詳細
│   ├── transactions/        取引一覧・登録
│   └── settings/            ユーザー設定
├── (public)/
│   └── stocks/[code]/       銘柄詳細（認証不要、anon クライアント）
└── auth/callback/           OAuth コールバック

components/
├── dashboard/               サマリカード、保有銘柄テーブル、円グラフ
├── layout/                  サイドバー、ヘッダー、ポートフォリオコンテキスト
├── portfolio/               ポートフォリオフォーム、削除ボタン
├── stock/                   ローソク足チャート、ファンダメンタルズ、決算スケジュール
├── transaction/             取引フォーム、銘柄オートコンプリート
└── ui/                      shadcn/ui コンポーネント

lib/
├── actions/                 Server Actions（auth, portfolio, transaction）
├── queries/                 データ取得関数（dashboard, stock, user-settings）
├── supabase/                Supabase クライアント（server, client, anon）
└── validations/             Zod スキーマ（auth, portfolio, transaction）

supabase/migrations/
├── 00001_portfolio_schema.sql    スキーマ・テーブル・インデックス・トリガー
├── 00002_portfolio_rls.sql       RLS 有効化 + 全 CRUD ポリシー
└── 00003_portfolio_rpc.sql       RPC 関数（holdings_summary, portfolio_summary, sector_allocation）

proxy.ts                     認証ルーティング（Next.js 16 Proxy）
```

### データソース

| テーブル | スキーマ | 用途 |
|---------|---------|------|
| `equity_master` | jquants_core | 銘柄マスタ（社名・市場・セクター） |
| `equity_bar_daily` | jquants_core | 日足株価（チャート・時価評価） |
| `financial_disclosure` | jquants_core | 決算開示データ（PER/PBR/ROE/配当利回り） |
| `earnings_calendar` | jquants_core | 決算発表スケジュール |
| `trading_calendar` | jquants_core | 営業日カレンダー（前営業日比算出） |
| `portfolios` | portfolio | ポートフォリオ定義 |
| `transactions` | portfolio | 売買取引履歴 |
| `dividend_records` | portfolio | 配当受取実績 |
| `watchlist_items` | portfolio | ウォッチリスト |
| `user_settings` | portfolio | ユーザー設定 |

## セットアップ

### 前提条件

- Node.js 20+
- Supabase プロジェクト（JapanStockDataPipeline でマイグレーション適用済み）
- Supabase Dashboard の API Settings で `portfolio` / `jquants_core` を Exposed Schemas に追加

### インストール

```bash
npm ci
```

### 環境変数

`.env.local.example` をコピーして `.env.local` を作成:

```bash
cp .env.local.example .env.local
```

| 変数 | 説明 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase プロジェクト URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key（クライアント用） |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key（サーバー用） |
| `NEXT_PUBLIC_SITE_URL` | アプリケーション URL（`http://localhost:3000`） |

### ローカル実行

```bash
npm run dev
```

### ビルド

```bash
npm run build
npm start
```

## デプロイ

Vercel にデプロイする場合、環境変数を Vercel Dashboard で設定してください。`NEXT_PUBLIC_SITE_URL` はデプロイ先の URL に変更します。

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| フレームワーク | Next.js 16 (App Router, Turbopack) |
| 言語 | TypeScript 5 |
| UI | React 19, Tailwind CSS 4, shadcn/ui |
| 認証・DB | Supabase (PostgreSQL, Auth, RLS) |
| チャート | Lightweight Charts (ローソク足), Recharts (円グラフ) |
| バリデーション | Zod 4 |
| アナリティクス | Vercel Analytics |
| デプロイ | Vercel |

## 実装上の特記事項

- **スキーマ分離**: `.schema("portfolio")` / `.schema("jquants_core")` で全クエリを明示的にスキーマ指定
- **RLS**: 全テーブルに `USING (user_id = auth.uid())` ポリシーを適用。ユーザー間のデータ隔離を DB レベルで保証
- **認証最適化**: proxy.ts で公開パスは `getUser()` をスキップし、不要な認証 API 呼び出しを削減
- **並列データ取得**: `Promise.all` で複数クエリを並列実行（ウォーターフォール回避）
- **RPC 関数**: 保有銘柄サマリ・ポートフォリオサマリ・セクター配分を DB 側で集計し、データ転送量を最小化
- **JST 日付**: `Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" })` で Vercel (UTC) 環境でも正しい日付を算出
- **エラーハンドリング**: 全クエリ関数で Supabase エラーを throw し、Next.js Error Boundary で捕捉

## ライセンス

MIT
