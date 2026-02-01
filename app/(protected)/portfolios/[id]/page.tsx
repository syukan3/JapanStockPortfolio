import { notFound } from "next/navigation";
import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase/server";
import { PortfolioFormDialog } from "@/components/portfolio/portfolio-form";
import { DeletePortfolioButton } from "@/components/portfolio/delete-portfolio-button";
import { accountTypeLabels } from "@/lib/validations/portfolio";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default async function PortfolioDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await getSupabaseServer();

  const [{ data: portfolio }, { data: transactions }] = await Promise.all([
    supabase
      .schema("portfolio")
      .from("portfolios")
      .select("id, name, account_type, description")
      .eq("id", id)
      .single(),
    supabase
      .schema("portfolio")
      .from("transactions")
      .select("id, trade_date, local_code, trade_type, quantity, unit_price")
      .eq("portfolio_id", id)
      .order("trade_date", { ascending: false })
      .limit(10),
  ]);

  if (!portfolio) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{portfolio.name}</h1>
          {portfolio.account_type && (
            <Badge variant="secondary" className="mt-1">
              {accountTypeLabels[portfolio.account_type] ??
                portfolio.account_type}
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <PortfolioFormDialog
            portfolio={portfolio}
            trigger={<Button variant="outline">編集</Button>}
          />
          <DeletePortfolioButton portfolioId={portfolio.id} />
        </div>
      </div>

      {portfolio.description && (
        <p className="text-muted-foreground">{portfolio.description}</p>
      )}

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">取引履歴</h2>
          <Button asChild size="sm">
            <Link href={`/transactions/new?portfolio_id=${id}`}>
              取引登録
            </Link>
          </Button>
        </div>

        {!transactions?.length ? (
          <p className="text-sm text-muted-foreground">
            取引がありません。
          </p>
        ) : (
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-left">日付</th>
                  <th className="p-3 text-left">銘柄</th>
                  <th className="p-3 text-left">種別</th>
                  <th className="p-3 text-right">数量</th>
                  <th className="p-3 text-right">単価</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} className="border-b">
                    <td className="p-3">{t.trade_date}</td>
                    <td className="p-3">{t.local_code}</td>
                    <td className="p-3">
                      <Badge
                        variant={
                          t.trade_type === "buy" ? "default" : "destructive"
                        }
                      >
                        {t.trade_type === "buy" ? "買い" : "売り"}
                      </Badge>
                    </td>
                    <td className="p-3 text-right">
                      {t.quantity.toLocaleString()}
                    </td>
                    <td className="p-3 text-right">
                      ¥{Number(t.unit_price).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
