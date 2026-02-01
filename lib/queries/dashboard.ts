import { getSupabaseServer } from "@/lib/supabase/server";

export type PortfolioSummary = {
  total_market_value: number | null;
  total_cost: number | null;
  unrealized_pnl: number | null;
  unrealized_pnl_pct: number | null;
  daily_change: number | null;
  daily_change_pct: number | null;
};

export type HoldingItem = {
  local_code: string;
  company_name: string | null;
  sector17_name: string | null;
  total_quantity: number | null;
  avg_cost: number | null;
  latest_close: number | null;
  unrealized_pnl: number | null;
  unrealized_pnl_pct: number | null;
};

export type SectorAllocation = {
  sector17_name: string;
  market_value: number;
  allocation_pct: number;
};

export async function getPortfolioSummary(
  portfolioId: string
): Promise<PortfolioSummary | null> {
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.schema("portfolio").rpc("fn_portfolio_summary", {
    p_portfolio_id: portfolioId,
  });
  if (error) throw new Error(`ポートフォリオサマリの取得に失敗: ${error.message}`);
  return (data as PortfolioSummary[] | null)?.[0] ?? null;
}

export async function getHoldingsSummary(
  portfolioId: string
): Promise<HoldingItem[]> {
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.schema("portfolio").rpc("fn_holdings_summary", {
    p_portfolio_id: portfolioId,
  });
  if (error) throw new Error(`保有銘柄の取得に失敗: ${error.message}`);
  return (data as HoldingItem[] | null) ?? [];
}

export async function getSectorAllocation(
  portfolioId: string
): Promise<SectorAllocation[]> {
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.schema("portfolio").rpc("fn_sector_allocation", {
    p_portfolio_id: portfolioId,
  });
  if (error) throw new Error(`セクター配分の取得に失敗: ${error.message}`);
  return (data as SectorAllocation[] | null) ?? [];
}
