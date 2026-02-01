-- RLS 有効化 + CRUD ポリシー

-- portfolios
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

-- transactions
ALTER TABLE portfolio.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own" ON portfolio.transactions
  FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "insert_own" ON portfolio.transactions
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "update_own" ON portfolio.transactions
  FOR UPDATE USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "delete_own" ON portfolio.transactions
  FOR DELETE USING ((select auth.uid()) = user_id);

-- watchlist_items
ALTER TABLE portfolio.watchlist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own" ON portfolio.watchlist_items
  FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "insert_own" ON portfolio.watchlist_items
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "update_own" ON portfolio.watchlist_items
  FOR UPDATE USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "delete_own" ON portfolio.watchlist_items
  FOR DELETE USING ((select auth.uid()) = user_id);

-- dividend_records
ALTER TABLE portfolio.dividend_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own" ON portfolio.dividend_records
  FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "insert_own" ON portfolio.dividend_records
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "update_own" ON portfolio.dividend_records
  FOR UPDATE USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "delete_own" ON portfolio.dividend_records
  FOR DELETE USING ((select auth.uid()) = user_id);

-- user_settings
ALTER TABLE portfolio.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own" ON portfolio.user_settings
  FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "insert_own" ON portfolio.user_settings
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "update_own" ON portfolio.user_settings
  FOR UPDATE USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "delete_own" ON portfolio.user_settings
  FOR DELETE USING ((select auth.uid()) = user_id);
