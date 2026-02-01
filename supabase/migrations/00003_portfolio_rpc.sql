-- RPC 関数: fn_holdings_summary, fn_portfolio_summary, fn_sector_allocation

-- ========================================
-- fn_holdings_summary: 保有銘柄一覧
-- ========================================
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
  v_codes text[] := '{}';
  v_qtys int[] := '{}';
  v_avgs numeric[] := '{}';
BEGIN
  FOR rec IN
    SELECT t.local_code, t.trade_type, t.quantity, t.unit_price, t.commission, t.tax
    FROM portfolio.transactions t
    WHERE t.portfolio_id = p_portfolio_id
      AND t.user_id = (select auth.uid())
    ORDER BY t.local_code, t.trade_date, t.id
  LOOP
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

    IF rec.trade_type = 'buy' THEN
      v_total_cost := v_qty * v_avg + rec.quantity * rec.unit_price + rec.commission + rec.tax;
      v_qty := v_qty + rec.quantity;
      v_avg := v_total_cost / NULLIF(v_qty, 0);
    ELSE
      v_qty := v_qty - rec.quantity;
    END IF;
  END LOOP;

  IF v_qty > 0 THEN
    v_codes := array_append(v_codes, v_code);
    v_qtys := array_append(v_qtys, v_qty);
    v_avgs := array_append(v_avgs, ROUND(v_avg, 2));
  END IF;

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

-- ========================================
-- fn_portfolio_summary: ポートフォリオサマリ
-- ========================================
CREATE OR REPLACE FUNCTION portfolio.fn_portfolio_summary(p_portfolio_id uuid)
RETURNS TABLE(
  total_market_value numeric(14,2),
  total_cost numeric(14,2),
  unrealized_pnl numeric(14,2),
  unrealized_pnl_pct numeric(8,4),
  daily_change numeric(14,2),
  daily_change_pct numeric(8,4)
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  WITH holdings AS (
    -- fn_holdings_summary から latest_close を再利用（重複LATERAL JOIN回避）
    SELECT local_code, total_quantity, avg_cost, latest_close
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
      h.latest_close,
      pp.adj_close AS prev_close
    FROM holdings h
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

-- ========================================
-- fn_sector_allocation: セクター別配分
-- ========================================
CREATE OR REPLACE FUNCTION portfolio.fn_sector_allocation(p_portfolio_id uuid)
RETURNS TABLE(
  sector17_name text,
  market_value numeric(14,2),
  allocation_pct numeric(8,4)
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

-- 実行権限
GRANT EXECUTE ON FUNCTION portfolio.fn_holdings_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION portfolio.fn_portfolio_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION portfolio.fn_sector_allocation(uuid) TO authenticated;
