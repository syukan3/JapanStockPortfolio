import { z } from "zod";

export const portfolioSchema = z.object({
  name: z.string().min(1, "ポートフォリオ名を入力してください").max(100),
  account_type: z
    .enum(["nisa_growth", "nisa_saving", "specific", "general"])
    .nullable()
    .optional(),
  description: z.string().max(500).nullable().optional(),
});

export type PortfolioInput = z.infer<typeof portfolioSchema>;

export const accountTypeLabels: Record<string, string> = {
  nisa_growth: "NISA成長投資枠",
  nisa_saving: "NISAつみたて投資枠",
  specific: "特定口座",
  general: "一般口座",
};
