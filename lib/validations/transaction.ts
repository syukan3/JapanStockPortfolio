import { z } from "zod";

export const transactionSchema = z.object({
  portfolio_id: z.string().uuid("ポートフォリオを選択してください"),
  local_code: z.string().regex(/^\d{5}$/, "銘柄コードは5桁の数字で入力してください"),
  trade_type: z.enum(["buy", "sell"]),
  trade_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付を入力してください"),
  quantity: z.coerce.number().int().positive("数量は1以上の整数で入力してください"),
  unit_price: z.coerce.number().positive("単価は正の数で入力してください"),
  commission: z.coerce.number().min(0, "手数料は0以上で入力してください").default(0),
  tax: z.coerce.number().min(0, "税金は0以上で入力してください").default(0),
  notes: z.string().max(500).nullable().optional(),
});

export type TransactionInput = z.infer<typeof transactionSchema>;
