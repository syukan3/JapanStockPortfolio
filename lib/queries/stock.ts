import { getSupabaseAnon } from "@/lib/supabase/anon";

export type StockMaster = {
  local_code: string;
  company_name: string;
  sector17_name: string | null;
  market_segment: string | null;
};

export type StockPrice = {
  trade_date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adj_close: number;
  volume: number;
};

export type FinancialData = {
  per: number | null;
  pbr: number | null;
  roe: number | null;
  dividend_yield: number | null;
};

export type EarningsEvent = {
  local_code: string;
  announcement_date: string;
  fiscal_year_end: string | null;
};

export async function getStockMaster(
  code: string
): Promise<StockMaster | null> {
  const supabase = getSupabaseAnon();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- jquants_core schema not in generated types
  const { data } = await (supabase as any)
    .schema("jquants_core")
    .from("equity_master")
    .select("local_code, company_name, sector17_name, market_segment")
    .eq("local_code", code)
    .eq("is_current", true)
    .single();
  return data as StockMaster | null;
}

export async function getStockPrices(
  code: string,
  limit = 250
): Promise<StockPrice[]> {
  const supabase = getSupabaseAnon();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- jquants_core schema not in generated types
  const { data } = await (supabase as any)
    .schema("jquants_core")
    .from("equity_bar_daily")
    .select("trade_date, open, high, low, close, adj_close, volume")
    .eq("local_code", code)
    .order("trade_date", { ascending: false })
    .limit(limit);
  return ((data as StockPrice[] | null) ?? []).reverse();
}

export async function getFinancials(
  code: string
): Promise<FinancialData | null> {
  const supabase = getSupabaseAnon();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- jquants_core schema not in generated types
  const { data } = await (supabase as any)
    .schema("jquants_core")
    .from("financial_disclosure")
    .select("per, pbr, roe, dividend_yield")
    .eq("local_code", code)
    .order("disclosure_date", { ascending: false })
    .limit(1)
    .single();
  return data as FinancialData | null;
}

export async function getEarningsSchedule(
  code: string
): Promise<EarningsEvent[]> {
  const supabase = getSupabaseAnon();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(new Date());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- jquants_core schema not in generated types
  const { data } = await (supabase as any)
    .schema("jquants_core")
    .from("earnings_calendar")
    .select("local_code, announcement_date, fiscal_year_end")
    .eq("local_code", code)
    .gte("announcement_date", today)
    .order("announcement_date", { ascending: true })
    .limit(5);
  return (data as EarningsEvent[] | null) ?? [];
}
