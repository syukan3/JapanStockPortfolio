# JapanStockPortfolio 実装計画

## 概要

SPEC.md に基づき、Next.js 16 ポートフォリオ管理アプリをゼロから実装する。
MVP は Phase 0 + Phase 1（F1〜F5）。全16ステップ、約68ファイル。

---

## チェックリスト

### Phase 0: 基盤構築

- [ ] **Step 1: プロジェクトスキャフォールディング** (~12 files)
  - [ ] `npx create-next-app@latest`（App Router, TypeScript, Tailwind, Turbopack）
  - [ ] 依存追加: `@supabase/ssr`, `@supabase/supabase-js`, `zod`, `recharts`, `lightweight-charts`, `swr`, `@vercel/analytics`
  - [ ] shadcn/ui 初期化 + 基本コンポーネント追加（button, input, card, table, dialog, select, toast, skeleton, tabs, badge, dropdown-menu, label）
  - [ ] `.env.local.example` に Supabase 環境変数3つ
  - [ ] ESLint 設定
  - [ ] 検証: `npm run dev` 起動、`npm run build` 成功

- [ ] **Step 2: Supabase クライアントライブラリ** (~3 files)
  - [ ] `lib/supabase/server.ts` — `React.cache()` ラップ `createServerClient`
  - [ ] `lib/supabase/client.ts` — `createBrowserClient` シングルトン
  - [ ] `lib/supabase/anon.ts` — cookies 不使用 anon クライアント（`"use cache"` 用）
  - [ ] 検証: テストページでインポート、エラーなし

- [ ] **Step 3: proxy.ts（認証ルーティング）** (1 file) ※Next.js 16 で `middleware.ts` は `proxy.ts` に置き換え
  - [ ] `proxy.ts` をプロジェクトルートに配置（Next.js 16 の正式エントリポイント、`middleware.ts` は非推奨）
  - [ ] Node.js ランタイム固定（Next.js 16 の proxy.ts は自動的に Node.js で実行、runtime export 不要）
  - [ ] セッション自動リフレッシュ（全リクエスト）
  - [ ] 未認証リダイレクト除外パス: `/login`, `/signup`, `/reset-password`, `/auth/callback`, `/stocks/*`
  - [ ] 認証済み `/login`|`/signup` → `/dashboard` リダイレクト
  - [ ] matcher: `_next/static`, `_next/image`, `favicon.ico` 除外
  - [ ] 検証: 未認証で `/dashboard` → `/login` リダイレクト、`/login` と `/auth/callback` はブロックされない

- [ ] **Step 4: 認証ページ（F1）** (~8 files)
  - [ ] `app/(auth)/layout.tsx` — センター配置カードレイアウト
  - [ ] `app/(auth)/login/page.tsx` — メール+パスワードログイン
  - [ ] `app/(auth)/signup/page.tsx` — サインアップ
  - [ ] `app/(auth)/reset-password/page.tsx` — パスワードリセット
  - [ ] `app/auth/callback/route.ts` — Supabase auth コールバック
  - [ ] `lib/actions/auth.ts` — Server Actions（login, signup, resetPassword, logout）
  - [ ] `lib/validations/auth.ts` — Zod スキーマ
  - [ ] 検証: アカウント作成 → ログイン → ログアウト → パスワードリセット

- [ ] **Step 5: DB マイグレーション — スキーマ + テーブル** (~3 files) ※Step 1〜4 と並列可
  - [ ] `supabase init`
  - [ ] `00001_portfolio_schema.sql`: `CREATE EXTENSION IF NOT EXISTS pgcrypto`, CREATE SCHEMA, GRANT, domain型, 5テーブル, インデックス, トリガー
  - [ ] `00002_portfolio_rls.sql`: RLS 有効化 + 全 CRUD ポリシー
  - [ ] 各マイグレーションに対応する `.down.sql`（ロールバック用）を用意
  - [ ] 検証: テーブル/RLS/インデックス存在確認、RLS クロスユーザーブロック

### Phase 1: ダッシュボード MVP

- [ ] **Step 6: DB マイグレーション — RPC 関数** (~1 file)
  - [ ] `00003_portfolio_rpc.sql`: fn_holdings_summary, fn_portfolio_summary, fn_sector_allocation
  - [ ] GRANT EXECUTE to authenticated
  - [ ] DataPipeline 側: 2インデックス追加依頼（別リポジトリ PR）
  - [ ] DataPipeline 側: `jquants_core` の GRANT USAGE/SELECT + RLS (`SELECT true`) ポリシー設定状況を確認（`authenticated` + `anon` 両方）。未設定なら先に対応
  - [ ] `/stocks/[code]` 公開ページ用: `anon` ロールにも `jquants_core` への USAGE/SELECT を付与（または SECURITY DEFINER の公開用 RPC を用意）。未認証ユーザーが市場データを閲覧可能にする
  - [ ] 検証: テストデータで RPC 呼び出し、正しい結果確認。`authenticated` と `anon` 両方で `jquants_core` テーブルの SELECT 可能確認

- [ ] **Step 7: TypeScript 型生成** (~1 file)
  - [ ] `supabase gen types typescript` → `lib/supabase/database.types.ts`
  - [ ] npm script: `"gen:types"`
  - [ ] Supabase クライアントに `Database` ジェネリック適用
  - [ ] 検証: テーブル名・カラム名の自動補完

- [ ] **Step 8: Protected レイアウト + ナビゲーション** (~6 files)
  - [ ] `app/(protected)/layout.tsx` — ユーザー取得、サイドバー、コンテキスト
  - [ ] `components/layout/sidebar.tsx` — ナビリンク
  - [ ] `components/layout/header.tsx` — ユーザーメニュー、ポートフォリオセレクター
  - [ ] `components/layout/portfolio-context.tsx` — 選択中ポートフォリオのコンテキスト
  - [ ] `lib/queries/user-settings.ts` — `getDefaultPortfolioId()` with `React.cache()`
  - [ ] 検証: ページ遷移でサイドバーハイライト、ユーザー情報表示

- [ ] **Step 9: ポートフォリオ CRUD（F2）** (~6 files)
  - [ ] `app/(protected)/portfolios/page.tsx` — 一覧（カード表示）
  - [ ] `app/(protected)/portfolios/[id]/page.tsx` — ポートフォリオ詳細（保有銘柄・取引サマリ）
  - [ ] `components/portfolio/portfolio-form.tsx` — 作成/編集ダイアログ
  - [ ] `lib/actions/portfolio.ts` — Server Actions（create, update, delete）
  - [ ] `lib/validations/portfolio.ts` — Zod スキーマ
  - [ ] 初回ポートフォリオ作成時に user_settings 自動生成
  - [ ] 検証: 作成 → 一覧表示 → 編集 → 削除

- [ ] **Step 10: 取引登録（F3）** (~7 files)
  - [ ] `app/(protected)/transactions/page.tsx` — 取引一覧（フィルタ・ソート）
  - [ ] `app/(protected)/transactions/new/page.tsx` — 登録フォーム
  - [ ] `components/transaction/transaction-form.tsx` — フォーム本体
  - [ ] `components/transaction/stock-autocomplete.tsx` — SWR 銘柄検索（`{ revalidateOnFocus: false, revalidateOnReconnect: false, revalidateIfStale: false }`、フォーカス時遅延ロード）
  - [ ] `lib/actions/transaction.ts`, `lib/validations/transaction.ts`
  - [ ] `app/(protected)/portfolios/[id]/transactions/page.tsx` — ポートフォリオ別取引
  - [ ] 検証: 買い登録 → 一覧 → 売り登録 → オートコンプリート動作

- [ ] **Step 11: ダッシュボード（F4）** (~9 files)
  - [ ] `app/(protected)/dashboard/page.tsx` — Suspense 3境界で並列ストリーミング
  - [ ] `components/dashboard/summary-cards.tsx` + skeleton — fn_portfolio_summary RPC（日次変動＝前営業日比も含む）
  - [ ] `components/dashboard/holdings-table.tsx` + skeleton — fn_holdings_summary RPC
  - [ ] `components/dashboard/allocation-chart.tsx` + skeleton — Recharts PieChart (dynamic ssr:false, named import で tree-shaking: `import { PieChart, Pie, Cell } from 'recharts'`)
  - [ ] `lib/queries/dashboard.ts` — RPC 呼び出しラッパー
  - [ ] 検証: サマリカード、保有銘柄テーブル（損益）、セクター円グラフ

- [ ] **Step 12: 銘柄詳細ページ（F5）** (~6 files) ※Step 9〜11 と独立
  - [ ] `app/(public)/stocks/[code]/page.tsx` — `"use cache"` + `cacheLife("minutes")` + `cacheTag("stock-${code}")`、anon クライアント
  - [ ] `components/stock/candlestick-chart.tsx` — Lightweight Charts (dynamic ssr:false)
  - [ ] `components/stock/stock-fundamentals.tsx` — PER/PBR/ROE/配当利回り
  - [ ] `components/stock/earnings-schedule.tsx` — 決算スケジュール
  - [ ] `components/stock/user-stock-actions.tsx` — Client Component（SWR + browserClient）
  - [ ] `lib/queries/stock.ts` — anon クエリ
  - [ ] 検証: 未認証で `/stocks/13010` アクセス可、キャッシュヘッダー確認

- [ ] **Step 13: エラーハンドリング + 空状態** (~5 files)
  - [ ] `app/error.tsx` — グローバルエラー（リトライボタン）
  - [ ] `app/not-found.tsx` — 404
  - [ ] `app/loading.tsx` — グローバル skeleton
  - [ ] `app/(protected)/error.tsx` — 403 でログアウト
  - [ ] `components/ui/empty-state.tsx` — 再利用可能な空状態
  - [ ] Toast 設定（Server Action エラー用）
  - [ ] 検証: エラー強制 → エラーページ、空ポートフォリオ → CTA

### Phase 1.5: パフォーマンスチャート

- [ ] **Step 14: パフォーマンスチャート（F4.5）** (~3 files)
  - [ ] `00004_fn_portfolio_performance.sql` — RPC 関数
  - [ ] `components/dashboard/performance-chart.tsx` — Recharts LineChart (dynamic ssr:false)
  - [ ] 期間セレクター: 1M/3M/6M/1Y/ALL
  - [ ] ダッシュボードに Suspense セクション追加
  - [ ] 検証: ポートフォリオ線 vs TOPIX 線、期間切替

### 共通基盤

- [ ] **Step 15: 設定ページ** (~3 files)
  - [ ] `app/(protected)/settings/page.tsx`
  - [ ] `lib/actions/settings.ts`, `lib/validations/settings.ts`
  - [ ] 検証: デフォルトポートフォリオ変更 → ダッシュボード反映

- [ ] **Step 16: CI/CD + テスト基盤** (~7 files) ※Step 1 以降いつでも
  - [ ] `.github/workflows/ci.yml` — lint + typecheck + vitest + build + playwright
  - [ ] `vitest.config.ts`
  - [ ] `playwright.config.ts` + 基本 E2E テスト（ログイン→ダッシュボード表示）
  - [ ] E2E テスト用セットアップ: テストユーザー作成スクリプト、DB シードデータ、CI 用 Supabase 環境変数（Secrets）
  - [ ] Zod スキーマ + ユーティリティの基本テスト
  - [ ] root layout に `<Analytics />` 配置
  - [ ] 検証: PR プッシュで CI パス（vitest + playwright）、Vercel Preview デプロイ

---

## 依存関係と実行順序

```
Step 1 (scaffolding) ──┬──→ Step 2 (supabase lib) → Step 3 (proxy) → Step 4 (auth F1)
                       │                                                     ↓
Step 5 (DB tables) ────┴──→ Step 6 (DB RPC) → Step 7 (types) ──→ Step 8 (layout)
                                                                      ↓
                              Step 9 (F2) → Step 10 (F3) → Step 11 (F4) → Step 14 (F4.5)
                                                                ↓
                              Step 12 (F5、Step 7 以降いつでも)    Step 13 (error)
                                                                ↓
                              Step 15 (settings)               Step 16 (CI/CD、Step 1以降いつでも)
```

**並列可能なグループ**:
- Step 1〜4（アプリ側）と Step 5（DB側）は並列
- Step 12（F5）は Step 7 完了後、Step 9〜11 と独立
- Step 16（CI）は Step 1 直後から着手可能

---

## Phase 2 以降（MVP 後）

| Step | 機能 | 概要 |
|------|------|------|
| 17 | 配当ダッシュボード (F6) | dividend_records CRUD + 月別/年別集計 |
| 18 | ウォッチリスト (F7) | watchlist_items CRUD + 現在値表示 |
| 19 | パフォーマンス分析 (F8) | fn_realized_pnl RPC + 銘柄別損益 |
| 20 | アラート通知 (F9) | Supabase Edge Functions + pg_cron |
| 21 | データエクスポート (F10) | CSV/Excel 出力 |

---

## 主要ファイルパス

| カテゴリ | パス |
|---|---|
| 仕様書 | `SPEC.md` |
| 実装計画 | `PLANS.md` |
| proxy | `proxy.ts` |
| Supabase lib | `lib/supabase/server.ts`, `client.ts`, `anon.ts` |
| DB マイグレーション | `supabase/migrations/0000*.sql` |
| Server Actions | `lib/actions/*.ts` |
| バリデーション | `lib/validations/*.ts` |
| クエリ | `lib/queries/*.ts` |
| ページ | `app/(auth)/*`, `app/(public)/*`, `app/(protected)/*` |
| コンポーネント | `components/layout/*`, `components/dashboard/*`, `components/stock/*`, `components/portfolio/*`, `components/transaction/*` |
