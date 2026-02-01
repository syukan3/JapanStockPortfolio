import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default async function TransactionsPage() {
  const supabase = await getSupabaseServer();
  const { data: transactions } = await supabase
    .schema("portfolio")
    .from("transactions")
    .select("id, trade_date, local_code, trade_type, quantity, unit_price, commission, portfolios(name)")
    .order("trade_date", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">取引履歴</h1>
        <Button asChild>
          <Link href="/transactions/new">取引登録</Link>
        </Button>
      </div>

      {!transactions?.length ? (
        <p className="text-muted-foreground">取引がありません。</p>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-3 text-left">日付</th>
                <th className="p-3 text-left">ポートフォリオ</th>
                <th className="p-3 text-left">銘柄</th>
                <th className="p-3 text-left">種別</th>
                <th className="p-3 text-right">数量</th>
                <th className="p-3 text-right">単価</th>
                <th className="p-3 text-right">手数料</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} className="border-b">
                  <td className="p-3">{t.trade_date}</td>
                  <td className="p-3 text-muted-foreground">
                    {(t.portfolios as unknown as { name: string } | null)?.name ?? "-"}
                  </td>
                  <td className="p-3 font-mono">{t.local_code}</td>
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
                  <td className="p-3 text-right">
                    ¥{Number(t.commission).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
