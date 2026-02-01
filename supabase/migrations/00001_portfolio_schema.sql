-- Portfolio スキーマ・テーブル・インデックス・トリガー
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- スキーマ作成
CREATE SCHEMA IF NOT EXISTS portfolio;

-- 権限設定
GRANT USAGE ON SCHEMA portfolio TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA portfolio TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA portfolio GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA portfolio TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA portfolio GRANT EXECUTE ON FUNCTIONS TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA portfolio TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA portfolio GRANT USAGE, SELECT ON SEQUENCES TO authenticated;

-- ドメイン型: 銘柄コード（5桁数字）
CREATE DOMAIN portfolio.local_code_t AS text
  CHECK (VALUE ~ '^\d{5}$');

-- updated_at 自動更新トリガー関数
CREATE OR REPLACE FUNCTION portfolio.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ========================================
-- portfolios: ポートフォリオ定義
-- ========================================
CREATE TABLE portfolio.portfolios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  account_type text CHECK (account_type IN ('nisa_growth', 'nisa_saving', 'specific', 'general')),
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name),
  UNIQUE (id, user_id)
);

-- UNIQUE (user_id, name) が user_id 単独検索もカバーするため単独インデックスは不要

CREATE TRIGGER trg_portfolios_updated_at
  BEFORE UPDATE ON portfolio.portfolios
  FOR EACH ROW EXECUTE FUNCTION portfolio.set_updated_at();

-- ========================================
-- transactions: 売買取引履歴
-- ========================================
CREATE TABLE portfolio.transactions (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  portfolio_id uuid NOT NULL,
  user_id uuid NOT NULL,
  local_code portfolio.local_code_t NOT NULL,
  trade_type text NOT NULL CHECK (trade_type IN ('buy', 'sell')),
  trade_date date NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL CHECK (unit_price > 0),
  commission numeric(10,2) NOT NULL DEFAULT 0 CHECK (commission >= 0),
  tax numeric(10,2) NOT NULL DEFAULT 0 CHECK (tax >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (portfolio_id, user_id) REFERENCES portfolio.portfolios(id, user_id) ON DELETE CASCADE
);

CREATE INDEX idx_transactions_user_portfolio ON portfolio.transactions (user_id, portfolio_id);
CREATE INDEX idx_transactions_portfolio_code_date ON portfolio.transactions (portfolio_id, local_code, trade_date, id);
CREATE INDEX idx_transactions_portfolio_date ON portfolio.transactions (portfolio_id, trade_date DESC);
CREATE INDEX idx_transactions_user_date ON portfolio.transactions (user_id, trade_date DESC);

-- ========================================
-- watchlist_items: ウォッチリスト
-- ========================================
CREATE TABLE portfolio.watchlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  local_code portfolio.local_code_t NOT NULL,
  memo text,
  target_price numeric(12,2),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, local_code)
);

-- ========================================
-- dividend_records: 配当受取実績
-- ========================================
CREATE TABLE portfolio.dividend_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  portfolio_id uuid NOT NULL,
  local_code portfolio.local_code_t NOT NULL,
  record_date date NOT NULL,
  payment_date date,
  dividend_per_share numeric(10,4) NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  gross_amount numeric(12,2) NOT NULL CHECK (gross_amount > 0),
  tax_amount numeric(10,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  net_amount numeric(12,2) NOT NULL CHECK (net_amount > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (portfolio_id, user_id) REFERENCES portfolio.portfolios(id, user_id) ON DELETE CASCADE,
  UNIQUE (user_id, portfolio_id, local_code, record_date)
);

-- UNIQUE制約 (user_id, portfolio_id, local_code, record_date) が user_id+portfolio_id をカバー
-- CASCADE削除用に portfolio_id 単独も残す（FK参照で必要）
CREATE INDEX idx_dividend_records_portfolio ON portfolio.dividend_records (portfolio_id);
CREATE INDEX idx_dividend_records_user_date ON portfolio.dividend_records (user_id, record_date);

-- ========================================
-- user_settings: ユーザー設定
-- ========================================
CREATE TABLE portfolio.user_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  default_portfolio_id uuid,
  cost_method text NOT NULL DEFAULT 'average' CHECK (cost_method IN ('average', 'fifo')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (default_portfolio_id, user_id) REFERENCES portfolio.portfolios(id, user_id) ON DELETE SET NULL
);

CREATE INDEX idx_user_settings_default_portfolio
  ON portfolio.user_settings (default_portfolio_id) WHERE default_portfolio_id IS NOT NULL;

CREATE TRIGGER trg_user_settings_updated_at
  BEFORE UPDATE ON portfolio.user_settings
  FOR EACH ROW EXECUTE FUNCTION portfolio.set_updated_at();
