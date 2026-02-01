# JapanStockPortfolio 要件定義書

## 概要

日本株ポートフォリオ管理Webアプリケーション。JapanStockDataPipelineが収集・蓄積する市場データ（株価・決算・配当・TOPIX等）を活用し、保有資産の可視化・パフォーマンス分析・配当管理を提供する。

## 基本方針

| 項目 | 決定事項 |
|---|---|
| フレームワーク | Next.js 16 (App Router) + TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| DB | Supabase（JapanStockDataPipelineと共有） |
| 認証 | Supabase Auth（複数ユーザー対応・RLS） |
| チャート | Lightweight Charts (TradingView) / Recharts |
| バンドラー | Turbopack（Next.js 16 デフォルト） |
| React | 19.2 |
| Node.js | 20.9+ |
| デプロイ | Vercel |
| 優先度 | ダッシュボード重視 |
| 言語 | 日本語のみ対応 |

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

### jquants_core へのアクセス権限

Portfolio ユーザーが `authenticated` ロールで読み取れるよう、DataPipeline 側で以下を設定する。

```sql
-- authenticated ロール（認証済みユーザー）
GRANT USAGE ON SCHEMA jquants_core TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA jquants_core TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA jquants_core GRANT SELECT ON TABLES TO authenticated;

-- anon ロール（/stocks/[code] 公開ページ用、未認証ユーザーの市場データ閲覧）
GRANT USAGE ON SCHEMA jquants_core TO anon;
GRANT SELECT ON ALL TABLES IN SCHEMA jquants_core TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA jquants_core GRANT SELECT ON TABLES TO anon;
```

**RLS について**: jquants_core テーブルは全ユーザー共通の公開市場データのため、RLS が有効な場合は DataPipeline 側で全テーブルに `FOR SELECT TO authenticated, anon USING (true)` ポリシーを設定する（`anon` は `/stocks/[code]` 公開ページで未認証ユーザーがアクセスするため必須）。RLS が無効であれば GRANT のみで十分。DataPipeline 側の RLS 設定状況を実装前に確認すること。

### jquants_core 側で必要なインデックス

Portfolio の RPC 関数が効率的に動作するため、DataPipeline 側で以下のインデックスが必要。

```sql
-- 最新株価取得（LATERAL JOIN）用 — 既存の idx_equity_bar_daily_date では不十分
CREATE INDEX IF NOT EXISTS idx_equity_bar_daily_code_date
  ON jquants_core.equity_bar_daily (local_code, trade_date DESC);

-- equity_master の is_current=true フィルタ用部分インデックス
CREATE INDEX IF NOT EXISTS idx_equity_master_code_current
  ON jquants_core.equity_master (local_code) WHERE is_current = true;
```

---

## 新規テーブル（スキーマ: `portfolio`）

Portfolio側で管理するデータ。全テーブルにRLSを設定し `auth.uid()` でユーザー分離する。

### スキーマ権限

```sql
-- portfolio スキーマへのアクセス権限
GRANT USAGE ON SCHEMA portfolio TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA portfolio TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA portfolio GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA portfolio TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA portfolio GRANT EXECUTE ON FUNCTIONS TO authenticated;
-- anon ロールにはアクセスを許可しない（認証必須）
```

### ドメイン型

```sql
-- 銘柄コードのドメイン型（CHECK 制約の重複を排除）
CREATE DOMAIN portfolio.local_code_t AS text
  CHECK (VALUE ~ '^\d{5}$');
```

各テーブルの `local_code` カラムは `portfolio.local_code_t` 型を使用する。個別テーブルでの `CHECK (local_code ~ '^\d{5}$')` は不要になる。

### PK 戦略

- **transactions**: 行数が多くなるため `bigint generated always as identity`（8 bytes、B-tree 断片化なし）
- **その他テーブル**: 行数が少ないため `uuid default gen_random_uuid()` で許容

### `portfolio.portfolios`

ポートフォリオ定義。

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid PK | DEFAULT gen_random_uuid() |
| user_id | uuid NOT NULL | FK auth.users(id), RLS key |
| name | text NOT NULL | ポートフォリオ名（例: "NISA成長投資枠"） |
| account_type | text | 口座種別 |
| description | text | メモ |
| created_at | timestamptz | DEFAULT now() |
| updated_at | timestamptz | DEFAULT now()（トリガーで自動更新） |

**UNIQUE**: (user_id, name), (id, user_id) — 子テーブルの複合FK用
**CHECK**: account_type IN ('nisa_growth', 'nisa_saving', 'specific', 'general')
**INDEX**: (user_id)
**TRIGGER**: updated_at を UPDATE 時に自動更新

### `portfolio.transactions`

売買取引履歴。保有数量はtransactionsから集計で算出する（single source of truth）。

| カラム | 型 | 説明 |
|---|---|---|
| id | bigint PK | generated always as identity |
| portfolio_id | uuid NOT NULL | FK (portfolio_id, user_id) REFERENCES portfolios(id, user_id) ON DELETE CASCADE |
| user_id | uuid NOT NULL | RLS key（冗長だがRLSパフォーマンスのため。複合FKで整合性保証） |
| local_code | local_code_t NOT NULL | 銘柄コード（5桁、ドメイン型） |
| trade_type | text NOT NULL | 'buy' / 'sell' |
| trade_date | date NOT NULL | 約定日 |
| quantity | integer NOT NULL | 株数（正の整数） |
| unit_price | numeric(12,2) NOT NULL | 約定単価 |
| commission | numeric(10,2) DEFAULT 0 | 手数料 |
| tax | numeric(10,2) DEFAULT 0 | 税金 |
| notes | text | メモ |
| created_at | timestamptz | DEFAULT now() |

**CHECK**: quantity > 0, unit_price > 0, commission >= 0, tax >= 0, trade_type IN ('buy', 'sell')
**INDEX**:
- (user_id, portfolio_id) — RLS + ポートフォリオ別取引一覧
- (portfolio_id, local_code, trade_date, id) — 銘柄別保有数量集計 + 移動平均計算の時系列ソート
- (portfolio_id, trade_date DESC) — 取引日順ソート・フィルタ
- (user_id, trade_date DESC) — 全取引一覧ページ用

### `portfolio.watchlist_items`

ウォッチリスト。

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid PK | DEFAULT gen_random_uuid() |
| user_id | uuid NOT NULL | RLS key |
| local_code | local_code_t NOT NULL | 銘柄コード（5桁、ドメイン型） |
| memo | text | メモ |
| target_price | numeric(12,2) | 目標株価 |
| sort_order | integer DEFAULT 0 | 表示順 |
| created_at | timestamptz | DEFAULT now() |

**UNIQUE**: (user_id, local_code) — ユニーク制約がインデックスを兼ねる

### `portfolio.dividend_records`

配当受取実績（自動算出できない特別配当等を手動記録するため）。

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid PK | DEFAULT gen_random_uuid() |
| user_id | uuid NOT NULL | RLS key |
| portfolio_id | uuid NOT NULL | FK (portfolio_id, user_id) REFERENCES portfolios(id, user_id) |
| local_code | local_code_t NOT NULL | 銘柄コード（5桁、ドメイン型） |
| record_date | date NOT NULL | 権利確定日 |
| payment_date | date | 入金日 |
| dividend_per_share | numeric(10,4) NOT NULL | 1株あたり配当金 |
| quantity | integer NOT NULL | 対象株数 |
| gross_amount | numeric(12,2) NOT NULL | 税引前配当金額 |
| tax_amount | numeric(10,2) DEFAULT 0 | 源泉徴収税 |
| net_amount | numeric(12,2) NOT NULL | 手取り配当金額 |
| created_at | timestamptz | DEFAULT now() |

**UNIQUE**: (user_id, portfolio_id, local_code, record_date)
**CHECK**: quantity > 0, gross_amount > 0, tax_amount >= 0, net_amount > 0
**INDEX**:
- (portfolio_id) — FK インデックス（CASCADE 削除用）
- (user_id, record_date) — 月別・年別集計用

### `portfolio.user_settings`

ユーザー設定。

| カラム | 型 | 説明 |
|---|---|---|
| user_id | uuid PK | FK auth.users(id) |
| default_portfolio_id | uuid | FK (default_portfolio_id, user_id) REFERENCES portfolios(id, user_id) ON DELETE SET NULL |
| cost_method | text DEFAULT 'average' | 取得単価計算方式 |
| created_at | timestamptz | DEFAULT now() |
| updated_at | timestamptz | DEFAULT now()（トリガーで自動更新） |

**CHECK**: cost_method IN ('average', 'fifo')
**INDEX**: (default_portfolio_id) WHERE default_portfolio_id IS NOT NULL — FK参照用

---

## RLS ポリシー設計

全テーブルで以下のパターンを適用する。

**重要**: `auth.uid()` は必ず `(select auth.uid())` でラップし、行ごとの関数呼び出しを防止する。

```sql
-- 全テーブル共通パターン（portfolios の例）
ALTER TABLE portfolio.portfolios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own" ON portfolio.portfolios
  FOR SELECT USING ((select auth.uid()) = user_id);

CREATE POLICY "insert_own" ON portfolio.portfolios
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "update_own" ON portfolio.portfolios
  FOR UPDATE USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "delete_own" ON portfolio.portfolios
  FOR DELETE USING ((select auth.uid()) = user_id);
```

transactions, watchlist_items, dividend_records, user_settings にも同様のポリシーを適用する。

---

## DB 側計算関数（RPC）

保有銘柄の集計をDB側で行い、クライアントの計算負荷を下げる。

### `portfolio.fn_holdings_summary(p_portfolio_id uuid)`

保有銘柄一覧（銘柄名・数量・平均取得単価・現在値・損益）を返すRPC関数。

```sql
CREATE OR REPLACE FUNCTION portfolio.fn_holdings_summary(p_portfolio_id uuid)
RETURNS TABLE(
  local_code text,
  company_name text,
  sector17_name text,
  total_quantity int,
  avg_cost numeric(12,2),
  latest_close numeric(12,2),
  unrealized_pnl numeric(12,2),
  unrealized_pnl_pct numeric(8,4)
)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  rec RECORD;
  v_code text := '';
  v_qty int := 0;
  v_avg numeric := 0;
  v_total_cost numeric := 0;
  -- 銘柄ごとの保有情報を配列で保持（TEMP TABLE を使わない）
  v_codes text[] := '{}';
  v_qtys int[] := '{}';
  v_avgs numeric[] := '{}';
BEGIN
  -- 単一クエリで全取引を取得し、local_code の変化を検知してループ（N+1 回避）
  -- 明示的に user_id フィルタを追加（RLS + プランナーのインデックス活用）
  FOR rec IN
    SELECT t.local_code, t.trade_type, t.quantity, t.unit_price, t.commission, t.tax
    FROM portfolio.transactions t
    WHERE t.portfolio_id = p_portfolio_id
      AND t.user_id = (select auth.uid())
    ORDER BY t.local_code, t.trade_date, t.id
  LOOP
    -- 銘柄が切り替わったら前の銘柄を保存
    IF rec.local_code IS DISTINCT FROM v_code THEN
      IF v_qty > 0 THEN
        v_codes := array_append(v_codes, v_code);
        v_qtys := array_append(v_qtys, v_qty);
        v_avgs := array_append(v_avgs, ROUND(v_avg, 2));
      END IF;
      v_code := rec.local_code;
      v_qty := 0;
      v_avg := 0;
    END IF;

    -- 移動平均法: 買い→(既存保有額+新規取得額)/(既存数量+新規数量)、売り→数量減のみ(単価不変)
    IF rec.trade_type = 'buy' THEN
      v_total_cost := v_qty * v_avg + rec.quantity * rec.unit_price + rec.commission + rec.tax;
      v_qty := v_qty + rec.quantity;
      v_avg := v_total_cost / NULLIF(v_qty, 0);
    ELSE -- sell
      v_qty := v_qty - rec.quantity;
    END IF;
  END LOOP;

  -- 最後の銘柄を保存
  IF v_qty > 0 THEN
    v_codes := array_append(v_codes, v_code);
    v_qtys := array_append(v_qtys, v_qty);
    v_avgs := array_append(v_avgs, ROUND(v_avg, 2));
  END IF;

  -- 最新株価を LATERAL JOIN で取得（インデックス利用が確実）
  -- 前提: jquants_core.equity_bar_daily に (local_code, trade_date DESC) インデックスが必要
  RETURN QUERY
  SELECT
    h.code,
    em.company_name,
    em.sector17_name,
    h.qty,
    h.avg_unit_cost,
    lp.adj_close,
    ROUND((lp.adj_close - h.avg_unit_cost) * h.qty, 2),
    ROUND((lp.adj_close - h.avg_unit_cost) / NULLIF(h.avg_unit_cost, 0) * 100, 4)
  FROM unnest(v_codes, v_qtys, v_avgs) AS h(code, qty, avg_unit_cost)
  LEFT JOIN LATERAL (
    SELECT ebd.adj_close FROM jquants_core.equity_bar_daily ebd
    WHERE ebd.local_code = h.code
    ORDER BY ebd.trade_date DESC LIMIT 1
  ) lp ON true
  LEFT JOIN jquants_core.equity_master em
    ON em.local_code = h.code AND em.is_current = true;
END;
$$;
```

**設計ポイント**:
- **TEMP TABLE 不使用**: 配列変数で保持し、`unnest()` で展開。`STABLE` 宣言と整合し、カタログロック競合を回避。Supabase の transaction mode pooling とも互換
- **N+1 回避**: 単一クエリで全取引を `ORDER BY local_code, trade_date, id` で取得し、`local_code` の変化を検知して1回のループで処理
- **明示的 user_id フィルタ**: RLS に加えて `WHERE t.user_id = (select auth.uid())` を明示。プランナーがインデックス `(user_id, portfolio_id)` を活用可能に
- **移動平均法**: 買い→`(既存保有額+新規取得額)/(既存数量+新規数量)`、売り→数量減のみ（単価不変）。例: 100株@1000円購入 → 50株売却 → 100株@1500円購入 → 平均単価 `(50*1000+100*1500)/150 = 1333円`

### `portfolio.fn_portfolio_summary(p_portfolio_id uuid)`

ポートフォリオ全体のサマリ（総資産評価額、総投資額、含み損益、日次変動）を返す。

```sql
CREATE OR REPLACE FUNCTION portfolio.fn_portfolio_summary(p_portfolio_id uuid)
RETURNS TABLE(
  total_market_value numeric(14,2),     -- 総資産評価額（現在値 × 数量の合計）
  total_cost numeric(14,2),             -- 総投資額（平均取得単価 × 数量の合計）
  unrealized_pnl numeric(14,2),         -- 含み損益
  unrealized_pnl_pct numeric(8,4),      -- 含み損益率(%)
  daily_change numeric(14,2),           -- 日次変動額（当日終値 - 前営業日終値）× 数量 の合計
  daily_change_pct numeric(8,4)         -- 日次変動率(%)
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  WITH holdings AS (
    SELECT local_code, total_quantity, avg_cost
    FROM portfolio.fn_holdings_summary(p_portfolio_id)
  ),
  prev_business_day AS (
    SELECT MAX(calendar_date) AS prev_date
    FROM jquants_core.trading_calendar
    WHERE is_business_day = true
      AND calendar_date < CURRENT_DATE
  ),
  priced AS (
    SELECT
      h.local_code,
      h.total_quantity,
      h.avg_cost,
      lp.adj_close AS latest_close,
      pp.adj_close AS prev_close
    FROM holdings h
    LEFT JOIN LATERAL (
      SELECT ebd.adj_close FROM jquants_core.equity_bar_daily ebd
      WHERE ebd.local_code = h.local_code ORDER BY ebd.trade_date DESC LIMIT 1
    ) lp ON true
    LEFT JOIN LATERAL (
      SELECT ebd.adj_close FROM jquants_core.equity_bar_daily ebd
      WHERE ebd.local_code = h.local_code
        AND ebd.trade_date <= (SELECT prev_date FROM prev_business_day)
      ORDER BY ebd.trade_date DESC LIMIT 1
    ) pp ON true
  )
  SELECT
    ROUND(SUM(latest_close * total_quantity), 2),
    ROUND(SUM(avg_cost * total_quantity), 2),
    ROUND(SUM((latest_close - avg_cost) * total_quantity), 2),
    ROUND(SUM((latest_close - avg_cost) * total_quantity)
      / NULLIF(SUM(avg_cost * total_quantity), 0) * 100, 4),
    ROUND(SUM((latest_close - COALESCE(prev_close, latest_close)) * total_quantity), 2),
    ROUND(SUM((latest_close - COALESCE(prev_close, latest_close)) * total_quantity)
      / NULLIF(SUM(COALESCE(prev_close, latest_close) * total_quantity), 0) * 100, 4)
  FROM priced;
$$;
```

**日次変動の計算方式**: `trading_calendar` で `is_business_day = true` かつ `CURRENT_DATE` 未満の最大日付を「前営業日」とし、各銘柄の前営業日終値と最新終値の差に保有数量を掛けて合算する。

### `portfolio.fn_sector_allocation(p_portfolio_id uuid)`

セクター別の資産配分を返す。

```sql
CREATE OR REPLACE FUNCTION portfolio.fn_sector_allocation(p_portfolio_id uuid)
RETURNS TABLE(
  sector17_name text,
  market_value numeric(14,2),      -- セクター別時価評価額
  allocation_pct numeric(8,4)      -- 構成比率(%)
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  WITH holdings AS (
    SELECT local_code, total_quantity, latest_close, sector17_name
    FROM portfolio.fn_holdings_summary(p_portfolio_id)
  ),
  sector_totals AS (
    SELECT
      COALESCE(sector17_name, '不明') AS sector17_name,
      SUM(latest_close * total_quantity) AS market_value
    FROM holdings
    GROUP BY COALESCE(sector17_name, '不明')
  )
  SELECT
    s.sector17_name,
    ROUND(s.market_value, 2),
    ROUND(s.market_value / NULLIF(SUM(s.market_value) OVER (), 0) * 100, 4)
  FROM sector_totals s
  ORDER BY s.market_value DESC;
$$;
```

### `portfolio.fn_portfolio_performance(p_portfolio_id uuid, p_from date, p_to date)`

日次の時価推移データを返す（パフォーマンスチャート用）。

```sql
CREATE OR REPLACE FUNCTION portfolio.fn_portfolio_performance(
  p_portfolio_id uuid, p_from date, p_to date
)
RETURNS TABLE(
  trade_date date,
  portfolio_value numeric(14,2),   -- ポートフォリオ時価評価額
  topix_close numeric(18,6),       -- TOPIX 終値（ベンチマーク）
  portfolio_index numeric(10,4),   -- ポートフォリオ指数（基準日=100）
  topix_index numeric(10,4)        -- TOPIX 指数（基準日=100）
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  -- 保有銘柄・数量は fn_holdings_summary の現在スナップショットを使用
  -- （期間中の売買による変動は Phase 2 で厳密化。MVP では現在保有ベース）
  WITH holdings AS (
    SELECT local_code, total_quantity
    FROM portfolio.fn_holdings_summary(p_portfolio_id)
  ),
  business_days AS (
    SELECT calendar_date
    FROM jquants_core.trading_calendar
    WHERE is_business_day = true
      AND calendar_date BETWEEN p_from AND p_to
  ),
  daily_values AS (
    SELECT
      bd.calendar_date AS trade_date,
      SUM(ebd.adj_close * h.total_quantity) AS portfolio_value
    FROM business_days bd
    CROSS JOIN holdings h
    LEFT JOIN LATERAL (
      SELECT ebd2.adj_close FROM jquants_core.equity_bar_daily ebd2
      WHERE ebd2.local_code = h.local_code AND ebd2.trade_date <= bd.calendar_date
      ORDER BY ebd2.trade_date DESC LIMIT 1
    ) ebd ON true
    GROUP BY bd.calendar_date
  ),
  base_values AS (
    SELECT
      portfolio_value AS base_pf,
      (SELECT t.close FROM jquants_core.topix_bar_daily t
       WHERE t.trade_date <= p_from ORDER BY t.trade_date DESC LIMIT 1) AS base_topix
    FROM daily_values WHERE trade_date = (SELECT MIN(trade_date) FROM daily_values)
  )
  SELECT
    dv.trade_date,
    ROUND(dv.portfolio_value, 2),
    tp.close,
    ROUND(dv.portfolio_value / NULLIF((SELECT base_pf FROM base_values), 0) * 100, 4),
    ROUND(tp.close / NULLIF((SELECT base_topix FROM base_values), 0) * 100, 4)
  FROM daily_values dv
  LEFT JOIN jquants_core.topix_bar_daily tp ON tp.trade_date = dv.trade_date
  ORDER BY dv.trade_date;
$$;
```

**制約（MVP）**: 現在の保有銘柄・数量でさかのぼって計算するため、期間中に売買があった場合は厳密ではない。Phase 2 で取引履歴を考慮した厳密版に改良する。

### `portfolio.fn_realized_pnl(p_portfolio_id uuid)`

実現損益（売却済み銘柄の確定損益）を返すRPC関数。Phase 2（F8）で実装する。

#### 実現損益の計算方式

売却時の取得単価は**移動平均法**（日本の税制標準）で計算する。

- **移動平均法**: 買い取引ごとに `(既存保有額 + 新規取得額) / (既存数量 + 新規数量)` で平均単価を更新。売却時はその時点の平均単価を取得原価とする
- 取得原価には手数料・税金を含める（`unit_price * quantity + commission + tax`）
- `user_settings.cost_method` で FIFO への切り替えも可能とするが、初期実装は移動平均法のみ
- **FIFO**: 古い買い取引から順に数量を消化し、対応する取得原価で損益計算

---

## Supabase クライアント戦略

`@supabase/ssr` パッケージを使用する（`@supabase/auth-helpers-nextjs` は非推奨）。

Supabase Server Client は `React.cache()` でリクエスト単位にキャッシュし、同一リクエスト内で複数の Server Component が同じクライアントインスタンスを共有する。

```ts
// lib/supabase/server.ts
import { cache } from "react";
export const getSupabaseServer = cache(async () => {
  const cookieStore = await cookies();
  return createServerClient(/* url, key, { cookies: ... } */);
});
```

| コンテキスト | 関数 | 用途 |
|---|---|---|
| Server Components / Route Handlers / Server Actions | `createServerClient()` | cookies() 経由でセッション取得 |
| Client Components | `createBrowserClient()` | ブラウザ側の認証・データ取得 |
| Proxy (proxy.ts) | `createServerClient()` | セッションリフレッシュ + 未認証リダイレクト（Node.jsランタイム） |

### 環境変数

| 変数 | 公開範囲 | 用途 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | クライアント + サーバー | Supabase プロジェクト URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | クライアント + サーバー | anon key（RLS 適用） |
| `SUPABASE_SERVICE_ROLE_KEY` | サーバーのみ | 管理用（RLS バイパス、通常は使用しない） |

Vercel で Production / Preview 環境を分離して管理する。

---

## 機能要件

### Phase 0: 認証基盤

#### F1: 認証
- Supabase Auth（メール+パスワード）
- ログイン / サインアップ / ログアウト / パスワードリセット
- 全ページを認証必須にする（Proxy で制御）
- 認証済みユーザーが `/login`, `/signup` にアクセスした場合は `/dashboard` にリダイレクト

### Phase 1: ダッシュボード（MVP）

#### F2: ポートフォリオCRUD
- ポートフォリオの作成・編集・削除
- 口座種別の選択

#### F3: 取引登録
- 買い/売りの登録フォーム
- 銘柄コード入力時にequity_masterから銘柄名をオートコンプリート
  - ~4000件（code + name で約200KB、gzip後 ~50KB）をSWRキャッシュし、クライアント側フィルタリング
  - フェッチタイミング: 入力フォーカス時に遅延ロード（初期バンドルに含めない）
  - SWR 設定: `{ revalidateOnFocus: false, revalidateOnReconnect: false, dedupingInterval: 86400000 }`（銘柄マスタは日次更新のため24時間キャッシュ）
- 取引一覧表示（フィルタ・ソート）

#### F4: ダッシュボード
- **サマリカード**: 総資産評価額、総投資額、含み損益（額・率）、日次変動
- **保有銘柄テーブル**: 銘柄名、保有数、取得単価、現在値、損益、損益率、セクター
- **資産配分チャート**: セクター別（sector17）円グラフ

#### F5: 銘柄詳細ページ
- 株価チャート（Lightweight Charts: ローソク足 + 出来高）
- 基本指標: PER、PBR、ROE、配当利回り（financial_disclosureから算出）
- 決算発表予定（earnings_calendar）
- 直近決算サマリ

### Phase 1.5: パフォーマンスチャート

#### F4.5: パフォーマンスチャート
- ポートフォリオ時価推移 vs TOPIX（期間選択: 1M/3M/6M/1Y/ALL）
- DB側RPC関数で日次時価推移を計算
- `/dashboard` ページ内にSuspense境界で追加配置する

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
- 実現損益（売却済み）サマリ — 移動平均法で算出
- セクター別リターン

### Phase 3: 拡張

#### F9: アラート通知
- 決算発表N日前リマインド
- 目標株価到達通知
- 実装方式: Supabase Edge Functions + pg_cron（Vercel cron の制限を回避）

#### F10: データエクスポート
- CSV/Excelエクスポート（取引履歴、配当実績）

---

## データフェッチ戦略

### ダッシュボード (F4)

各セクションを独立した Server Component とし、Suspense 境界で並列ストリーミングする。
DashboardPage（親 Server Component）で `portfolio_id` を解決（`user_settings.default_portfolio_id` またはポートフォリオ一覧の先頭）し、props で子コンポーネントに渡す。`React.cache()` で user_settings 取得を重複排除する。

```tsx
export default async function DashboardPage() {
  const portfolioId = await getDefaultPortfolioId(); // React.cache() 付き
  return (
    <>
      <Suspense fallback={<SummaryCardsSkeleton />}>
        <SummaryCards portfolioId={portfolioId} />
      </Suspense>
      <Suspense fallback={<HoldingsTableSkeleton />}>
        <HoldingsTable portfolioId={portfolioId} />
      </Suspense>
      <Suspense fallback={<ChartSkeleton />}>
        <AllocationChart portfolioId={portfolioId} />
      </Suspense>
    </>
  );
}
```

### チャートコンポーネント

全チャートは `next/dynamic` でクライアントのみ遅延ロードする（SSR しない）。各ページで使用するライブラリのみ dynamic import し、未使用ライブラリはバンドルに含めない。

| ページ | ライブラリ | 用途 |
|---|---|---|
| ダッシュボード | Recharts | 円グラフ（セクター配分）・折れ線グラフ（パフォーマンス） |
| 銘柄詳細 (`/stocks/[code]`) | Lightweight Charts | ローソク足 + 出来高 |

```tsx
const CandlestickChart = dynamic(
  () => import('@/components/charts/CandlestickChart'),
  { ssr: false, loading: () => <ChartSkeleton /> }
);
```

### ページ別キャッシュ戦略

Next.js 16 ではキャッシュは明示的 opt-in（`"use cache"` ディレクティブ）。デフォルトではすべて動的実行される。

| ページ | 戦略 | 理由 |
|---|---|---|
| `/dashboard` | Dynamic + Suspense ストリーミング | ユーザー固有データ、常に最新 |
| `/stocks/[code]` | `"use cache"` + `cacheLife("minutes")` for 公開データ + Client SWR for ユーザー固有データ | 株価・企業情報はキャッシュ、保有状況・ウォッチリスト状態はClient Componentで取得 |
| `/login`, `/signup` | `"use cache"` (Static) | ユーザー非依存 |
| `/portfolios/[id]` | Dynamic | ユーザー固有データ |

---

## 非機能要件

| 項目 | 要件 |
|---|---|
| レスポンス | ダッシュボード初期表示 < 2秒（Suspense ストリーミング + RPC 活用） |
| モバイル | レスポンシブ対応（PC優先だがスマホでも閲覧可能） |
| セキュリティ | RLSで全テーブルをユーザー分離。service_roleキーはサーバー側のみ |
| アクセシビリティ | WCAG 2.1 AA準拠（shadcn/uiベース） |
| テスト | Vitest + Playwright（E2E） |
| CI/CD | GitHub Actions → Vercel Preview/Production |
| 監視 | Vercel Analytics（`@vercel/analytics` の `<Analytics />` を root layout に配置、内部で自動遅延ロード） + Supabase Dashboard。将来 Sentry 導入時は `next/script strategy="afterInteractive"` を使用 |
| バックアップ | Supabase 自動バックアップに依存 |
| オフライン | 非対応（PWA は Phase 3+ で検討可） |

---

## Server Actions セキュリティ要件

Server Actions は公開エンドポイントとして扱い、proxy.ts のガードに依存しない。

- **認証チェック**: 全 Server Action の先頭で `supabase.auth.getUser()` を実行し、未認証なら即座にエラーを返す。RLS は二重防御として機能させる
- **入力バリデーション**: Zod スキーマで全入力を検証する。型安全性だけでなく、ビジネスルール（quantity > 0、local_code 5桁等）も Zod で定義
- **エラーハンドリング**: Server Action 内のエラーはクライアントに安全な形で返す（内部エラー詳細を露出しない）

```ts
// Server Action の共通パターン
"use server";
async function createTransaction(formData: FormData) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const parsed = transactionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error("Validation failed");

  // RLS が適用された状態で INSERT
  const { error } = await supabase
    .from("transactions")
    .insert({ ...parsed.data, user_id: user.id });
  if (error) throw new Error("Failed to create transaction");
}
```

---

## エラーハンドリング

| エラー種別 | 対応 |
|---|---|
| Supabase 接続エラー | `error.tsx` でリトライボタン付きエラー画面 |
| 認証期限切れ (401) | proxy.ts でセッションリフレッシュ。失敗時 `/login` にリダイレクト |
| RLS 違反 (403) | ログアウト + `/login` にリダイレクト |
| データ未取得 | `not-found.tsx` または空状態コンポーネント |
| Server Action 失敗 | トースト通知で再試行を促す |

---

## ページ構成（App Router）

```
app/
  (auth)/                    ← 認証不要グループ
    login/page.tsx           → ログイン
    signup/page.tsx          → サインアップ
    reset-password/page.tsx  → パスワードリセット
  (public)/                  ← 認証不要・ISR対応グループ
    stocks/
      [code]/page.tsx        → 銘柄詳細（F5）— "use cache" + cacheLife("minutes")
                               公開データはキャッシュ、保有/ウォッチリストはClient SWR
  (protected)/               ← 認証必須グループ（cookies()使用 → 常にdynamic）
    layout.tsx               → Supabase セッション検証・ユーザー情報コンテキスト提供
    dashboard/
      page.tsx               → メインダッシュボード（F4）
      dividends/page.tsx     → 配当ダッシュボード（F6）
    portfolios/
      page.tsx               → ポートフォリオ一覧（F2）
      [id]/
        page.tsx             → ポートフォリオ詳細（保有銘柄・取引一覧）
        transactions/page.tsx → ポートフォリオ別取引一覧
    transactions/
      page.tsx               → 全取引一覧（F3）
      new/page.tsx           → 取引登録
    watchlist/page.tsx       → ウォッチリスト（F7）
    analytics/page.tsx       → パフォーマンス分析（F8: 実現損益・セクター別リターン）
    settings/page.tsx        → ユーザー設定
  error.tsx                  → グローバルエラー画面
  not-found.tsx              → 404 画面
  loading.tsx                → グローバルローディング（skeleton UI）
proxy.ts                   → セッションリフレッシュ + 認証リダイレクト（Node.jsランタイム）
```

**注意**: `/stocks/[code]` は `(public)` グループに配置し、`"use cache"` で公開市場データをキャッシュする。Proxy は `/stocks/[code]` でもセッションリフレッシュは行うが、未認証時のリダイレクトはスキップする。

#### `/stocks/[code]` のキャッシュ / 認証境界

| 区分 | レンダリング | データ取得方法 | 認証依存 |
|---|---|---|---|
| Server Component (cached) | `"use cache"` + `cacheTag("stock-${code}")` | anon key の Supabase クライアント（cookies 不使用） | なし |
| Client Component (dynamic) | SWR | `createBrowserClient()` で認証付き取得 | あり |

- **cached 部分**: 株価データ、企業情報、決算データ。`createServerClient()` (cookies ベース) を**使用してはならない**。anon key で認証なしフェッチし、全ユーザーで共有キャッシュとする
- **dynamic 部分**: 保有状況、ウォッチリスト登録状態。Client Component + SWR で `createBrowserClient()` を使用

### Proxy（Next.js 16 の proxy.ts）

Next.js 16 では `middleware.ts` が `proxy.ts` に置き換えられた（Node.js ランタイムで実行）。

```ts
// proxy.ts
// - 全リクエストで Supabase セッションを自動リフレッシュ
// - 未認証ユーザーを /login にリダイレクト
// - 認証済みユーザーが /login, /signup にアクセス → /dashboard にリダイレクト
// - matcher: /((?!_next/static|_next/image|favicon.ico).*)
```

---

## CI/CD

### GitHub Actions ワークフロー

1. **PR 時**: lint + type-check + unit test (Vitest) + build check
2. **PR マージ時**: Vercel Production デプロイ（自動）
3. **Vercel Preview**: PR ごとに自動デプロイ

### DB マイグレーション

- `portfolio` スキーマのマイグレーションは本リポジトリで管理
- `supabase/migrations/` ディレクトリに SQL ファイルを配置
- **Production**: main マージ後、手動承認ステップを経て `supabase db push` を実行
- **Preview 環境**: マイグレーションは実行しない（既存スキーマで動作確認のみ）
- **ロールバック**: 各マイグレーションに対応する down ファイルを用意

### 環境変数管理

Vercel Environment Variables で Production / Preview / Development を分離。Preview 環境は Supabase の同一プロジェクトを参照（RLS でデータ分離済み）。

**Preview 環境の安全対策**:
- Preview 環境には `SUPABASE_SERVICE_ROLE_KEY` を**設定しない**（RLS バイパスを防止）
- 将来的に Supabase Branching が利用可能になった場合、Preview 用の別ブランチ DB を検討する

---

## 技術的な判断メモ

1. **保有数量はtransactionsから集計**: holdingsテーブルを別に持たず、transactionsのbuy/sellを集計して算出する。データの整合性が保証される。DB側RPC関数で計算し、クライアントの負荷を下げる。
2. **RPC関数活用**: 保有銘柄サマリ・セクター配分・パフォーマンス推移はSupabase RPC関数でDB側計算する。`SECURITY INVOKER` でRLSを適用。
3. **equity_masterはis_current=trueのみ参照**: SCD Type2の履歴データはPortfolio側では不要。
4. **user_idの冗長保持**: transactionsにuser_idを持たせることで、JOINなしでRLSポリシーを適用できる。RLSポリシーでは `(select auth.uid())` パターンで行ごとの関数呼び出しを防止する。
5. **dividend_records**: financial_disclosureの配当データから自動計算もできるが、税額や端数処理の正確性のため手動記録テーブルも用意する。
6. **Supabaseクライアント**: `@supabase/ssr` を使用。Server Components では `createServerClient()`、Client Components では `createBrowserClient()` を使い分ける。
7. **実現損益**: 移動平均法（日本の税制標準）で計算。将来的にFIFOも `user_settings.cost_method` で切り替え可能にする。
8. **numeric精度**: 日本株は株価が整数〜小数1桁が大半のため、`numeric(12,2)` を基本とする。配当金のみ `numeric(10,4)` で小数4桁まで対応。
9. **local_code 5桁固定**: jquants_core 側のマイグレーションで `local_code` は5桁テキストとして定義されていることを確認済み（`COMMENT ON COLUMN ... IS '銘柄コード (5桁)'`）。ドメイン型 `portfolio.local_code_t` で CHECK 制約 `^\d{5}$` を一元管理する。
10. **portfolio_id と user_id の整合性**: transactions / dividend_records で `FOREIGN KEY (portfolio_id, user_id) REFERENCES portfolios(id, user_id)` の複合FKを設定し、他ユーザーのポートフォリオへの誤参照をDB制約レベルで防止する。
