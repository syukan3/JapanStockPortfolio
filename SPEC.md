# JapanStockPortfolio 要件定義書

## 概要

日本株ポートフォリオ管理Webアプリケーション。JapanStockDataPipelineが収集・蓄積する市場データ（株価・決算・配当・TOPIX等）を活用し、保有資産の可視化・パフォーマンス分析・配当管理を提供する。

## 基本方針

| 項目 | 決定事項 |
|---|---|
| フレームワーク | Next.js 15 (App Router) + TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| DB | Supabase（JapanStockDataPipelineと共有） |
| 認証 | Supabase Auth（複数ユーザー対応・RLS） |
| チャート | Lightweight Charts (TradingView) / Recharts |
| デプロイ | Vercel |
| 優先度 | ダッシュボード重視 |

---

## データソース（既存テーブル・読み取り専用）

スキーマ `jquants_core` のテーブルを参照する。Portfolio側からは**SELECT のみ**。

| テーブル | 用途 |
|---|---|
| `equity_master` | 銘柄名・セクター・市場区分（`is_current=true`のみ使用） |
| `equity_bar_daily` | 日足株価（時価評価・チャート・パフォーマンス計算） |
| `topix_bar_daily` | TOPIX（ベンチマーク比較） |
| `financial_disclosure` | 決算データ（PER/PBR/ROE/配当利回り算出） |
| `earnings_calendar` | 決算発表スケジュール（アラート） |
| `trading_calendar` | 営業日判定 |

---

## 新規テーブル（スキーマ: `portfolio`）

Portfolio側で管理するデータ。全テーブルにRLSを設定し `auth.uid()` でユーザー分離する。

### `portfolio.portfolios`

ポートフォリオ定義。

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid PK | DEFAULT gen_random_uuid() |
| user_id | uuid NOT NULL | FK auth.users(id), RLS key |
| name | text NOT NULL | ポートフォリオ名（例: "NISA成長投資枠"） |
| account_type | text | 口座種別（nisa_growth / nisa_saving / specific / general） |
| description | text | メモ |
| created_at | timestamptz | DEFAULT now() |
| updated_at | timestamptz | DEFAULT now() |

**UNIQUE**: (user_id, name)

### `portfolio.transactions`

売買取引履歴。保有数量はtransactionsから集計で算出する（single source of truth）。

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid PK | DEFAULT gen_random_uuid() |
| portfolio_id | uuid NOT NULL | FK portfolios(id) ON DELETE CASCADE |
| user_id | uuid NOT NULL | RLS key（冗長だがRLSパフォーマンスのため） |
| local_code | text NOT NULL | 銘柄コード（5桁） |
| trade_type | text NOT NULL | 'buy' / 'sell' |
| trade_date | date NOT NULL | 約定日 |
| quantity | integer NOT NULL | 株数（正の整数） |
| unit_price | numeric(18,6) NOT NULL | 約定単価 |
| commission | numeric(18,6) DEFAULT 0 | 手数料 |
| tax | numeric(18,6) DEFAULT 0 | 税金 |
| notes | text | メモ |
| created_at | timestamptz | DEFAULT now() |

**CHECK**: quantity > 0, unit_price > 0, trade_type IN ('buy', 'sell')
**INDEX**: (user_id, portfolio_id, local_code, trade_date)

### `portfolio.watchlist_items`

ウォッチリスト。

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid PK | DEFAULT gen_random_uuid() |
| user_id | uuid NOT NULL | RLS key |
| local_code | text NOT NULL | 銘柄コード |
| memo | text | メモ |
| target_price | numeric(18,6) | 目標株価 |
| created_at | timestamptz | DEFAULT now() |

**UNIQUE**: (user_id, local_code)

### `portfolio.dividend_records`

配当受取実績（自動算出できない特別配当等を手動記録するため）。

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid PK | DEFAULT gen_random_uuid() |
| user_id | uuid NOT NULL | RLS key |
| portfolio_id | uuid NOT NULL | FK portfolios(id) |
| local_code | text NOT NULL | 銘柄コード |
| record_date | date NOT NULL | 権利確定日 |
| payment_date | date | 入金日 |
| dividend_per_share | numeric(18,6) NOT NULL | 1株あたり配当金 |
| quantity | integer NOT NULL | 対象株数 |
| gross_amount | numeric(18,6) NOT NULL | 税引前配当金額 |
| tax_amount | numeric(18,6) DEFAULT 0 | 源泉徴収税 |
| net_amount | numeric(18,6) NOT NULL | 手取り配当金額 |
| created_at | timestamptz | DEFAULT now() |

---

## 機能要件

### Phase 1: ダッシュボード（MVP）

#### F1: 認証
- Supabase Auth（メール+パスワード）
- ログイン / サインアップ / ログアウト
- 全ページを認証必須にする

#### F2: ポートフォリオCRUD
- ポートフォリオの作成・編集・削除
- 口座種別の選択

#### F3: 取引登録
- 買い/売りの登録フォーム
- 銘柄コード入力時にequity_masterから銘柄名をオートコンプリート
- 取引一覧表示（フィルタ・ソート）

#### F4: ダッシュボード
- **サマリカード**: 総資産評価額、総投資額、含み損益（額・率）、日次変動
- **保有銘柄テーブル**: 銘柄名、保有数、取得単価、現在値、損益、損益率、セクター
- **資産配分チャート**: セクター別（sector17）円グラフ
- **パフォーマンスチャート**: ポートフォリオ時価推移 vs TOPIX（期間選択: 1M/3M/6M/1Y/ALL）

#### F5: 銘柄詳細ページ
- 株価チャート（Lightweight Charts: ローソク足 + 出来高）
- 基本指標: PER、PBR、ROE、配当利回り（financial_disclosureから算出）
- 決算発表予定（earnings_calendar）
- 直近決算サマリ

### Phase 2: 配当・分析

#### F6: 配当ダッシュボード
- 月別・年別配当受取実績
- 予想年間配当収入（保有数 × 予想配当）
- 配当利回りランキング（保有銘柄内）

#### F7: ウォッチリスト
- 銘柄追加・削除
- 現在値・変動率・目標株価との乖離率表示
- 決算発表予定表示

#### F8: パフォーマンス分析
- 銘柄別損益貢献度
- 実現損益（売却済み）サマリ
- セクター別リターン

### Phase 3: 拡張

#### F9: アラート通知
- 決算発表N日前リマインド
- 目標株価到達通知

#### F10: データエクスポート
- CSV/Excelエクスポート（取引履歴、配当実績）

---

## 非機能要件

| 項目 | 要件 |
|---|---|
| レスポンス | ダッシュボード初期表示 < 2秒（ISR/SSR活用） |
| モバイル | レスポンシブ対応（PC優先だがスマホでも閲覧可能） |
| セキュリティ | RLSで全テーブルをユーザー分離。service_roleキーはサーバー側のみ |
| アクセシビリティ | WCAG 2.1 AA準拠（shadcn/uiベース） |
| テスト | Vitest + Playwright（E2E） |
| CI/CD | GitHub Actions → Vercel Preview/Production |

---

## ページ構成（App Router）

```
/                    → リダイレクト（/dashboard or /login）
/login               → ログイン
/signup              → サインアップ
/dashboard           → メインダッシュボード（F4）
/dashboard/dividends → 配当ダッシュボード（F6）
/portfolios          → ポートフォリオ一覧（F2）
/portfolios/[id]     → ポートフォリオ詳細（保有銘柄・取引一覧）
/stocks/[code]       → 銘柄詳細（F5）
/transactions/new    → 取引登録（F3）
/watchlist           → ウォッチリスト（F7）
/settings            → ユーザー設定
```

---

## 技術的な判断メモ

1. **保有数量はtransactionsから集計**: holdingsテーブルを別に持たず、transactionsのbuy/sellを集計して算出する。データの整合性が保証される。
2. **ビュー活用**: 頻繁にアクセスするポートフォリオ評価額などはSupabase側にマテリアライズドビューまたはRPC関数を用意し、クライアントの計算負荷を下げる。
3. **equity_masterはis_current=trueのみ参照**: SCD Type2の履歴データはPortfolio側では不要。
4. **user_idの冗長保持**: transactionsにuser_idを持たせることで、JOINなしでRLSポリシーを適用できる。
5. **dividend_records**: financial_disclosureの配当データから自動計算もできるが、税額や端数処理の正確性のため手動記録テーブルも用意する。
