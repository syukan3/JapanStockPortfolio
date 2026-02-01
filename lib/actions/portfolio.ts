"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase/server";
import { portfolioSchema } from "@/lib/validations/portfolio";

export type PortfolioActionState = {
  error?: string;
  success?: boolean;
};

export async function createPortfolio(
  _prevState: PortfolioActionState,
  formData: FormData
): Promise<PortfolioActionState> {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "認証が必要です" };

  const parsed = portfolioSchema.safeParse({
    name: formData.get("name"),
    account_type: formData.get("account_type") || null,
    description: formData.get("description") || null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { error } = await supabase.schema("portfolio").from("portfolios").insert({
    user_id: user.id,
    ...parsed.data,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "同じ名前のポートフォリオが既に存在します" };
    }
    return { error: "ポートフォリオの作成に失敗しました" };
  }

  // user_settings が無ければ自動生成
  await supabase
    .schema("portfolio")
    .from("user_settings")
    .upsert({ user_id: user.id }, { onConflict: "user_id" });

  revalidatePath("/portfolios");
  return { success: true };
}

export async function updatePortfolio(
  portfolioId: string,
  _prevState: PortfolioActionState,
  formData: FormData
): Promise<PortfolioActionState> {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "認証が必要です" };

  const parsed = portfolioSchema.safeParse({
    name: formData.get("name"),
    account_type: formData.get("account_type") || null,
    description: formData.get("description") || null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { error } = await supabase
    .schema("portfolio")
    .from("portfolios")
    .update(parsed.data)
    .eq("id", portfolioId)
    .eq("user_id", user.id);

  if (error) {
    return { error: "ポートフォリオの更新に失敗しました" };
  }

  revalidatePath("/portfolios");
  return { success: true };
}

export async function deletePortfolio(portfolioId: string) {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "認証が必要です" };

  const { error } = await supabase
    .schema("portfolio")
    .from("portfolios")
    .delete()
    .eq("id", portfolioId)
    .eq("user_id", user.id);

  if (error) {
    return { error: "ポートフォリオの削除に失敗しました" };
  }

  revalidatePath("/portfolios");
  return { success: true };
}
