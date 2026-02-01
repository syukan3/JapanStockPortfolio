import { cache } from "react";
import { getSupabaseServer } from "@/lib/supabase/server";

export const getDefaultPortfolioId = cache(async (): Promise<string | null> => {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // user_settings からデフォルトポートフォリオを取得
  const { data: settings } = await supabase
    .schema("portfolio")
    .from("user_settings")
    .select("default_portfolio_id")
    .eq("user_id", user.id)
    .single();

  if (settings?.default_portfolio_id) {
    return settings.default_portfolio_id;
  }

  // なければ最初のポートフォリオを返す
  const { data: portfolios } = await supabase
    .schema("portfolio")
    .from("portfolios")
    .select("id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);

  return portfolios?.[0]?.id ?? null;
});
