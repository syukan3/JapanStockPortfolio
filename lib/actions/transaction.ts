"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { transactionSchema } from "@/lib/validations/transaction";

export type TransactionActionState = {
  error?: string;
  success?: boolean;
};

export async function createTransaction(
  _prevState: TransactionActionState,
  formData: FormData
): Promise<TransactionActionState> {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "認証が必要です" };

  const parsed = transactionSchema.safeParse({
    portfolio_id: formData.get("portfolio_id"),
    local_code: formData.get("local_code"),
    trade_type: formData.get("trade_type"),
    trade_date: formData.get("trade_date"),
    quantity: formData.get("quantity"),
    unit_price: formData.get("unit_price"),
    commission: formData.get("commission") || 0,
    tax: formData.get("tax") || 0,
    notes: formData.get("notes") || null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { error } = await supabase.schema("portfolio").from("transactions").insert({
    ...parsed.data,
    user_id: user.id,
  });

  if (error) {
    return { error: "取引の登録に失敗しました" };
  }

  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath(`/portfolios/${parsed.data.portfolio_id}`);
  redirect("/transactions");
}

export async function deleteTransaction(transactionId: number) {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "認証が必要です" };

  const { error } = await supabase
    .schema("portfolio")
    .from("transactions")
    .delete()
    .eq("id", transactionId)
    .eq("user_id", user.id);

  if (error) {
    return { error: "取引の削除に失敗しました" };
  }

  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  return { success: true };
}
