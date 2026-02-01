import Link from "next/link";
import { getHoldingsSummary } from "@/lib/queries/dashboard";
import { Badge } from "@/components/ui/badge";

export async function HoldingsTable({
  portfolioId,
}: {
  portfolioId: string;
}) {
  const holdings = await getHoldingsSummary(portfolioId);

  if (!holdings.length) {
    return (
      <div className="rounded-md border p-8 text-center text-muted-foreground">
        保有銘柄がありません。取引を登録してください。
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="p-3 text-left">銘柄</th>
            <th className="p-3 text-left">セクター</th>
            <th className="p-3 text-right">数量</th>
            <th className="p-3 text-right">取得単価</th>
            <th className="p-3 text-right">現在値</th>
            <th className="p-3 text-right">含み損益</th>
            <th className="p-3 text-right">損益率</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((h) => {
            const pnlColor =
              (h.unrealized_pnl ?? 0) >= 0 ? "text-green-600" : "text-red-600";
            return (
              <tr key={h.local_code} className="border-b">
                <td className="p-3">
                  <Link
                    href={`/stocks/${h.local_code}`}
                    className="hover:underline"
                  >
                    <span className="font-mono">{h.local_code}</span>
                    <span className="ml-2 text-muted-foreground">
                      {h.company_name}
                    </span>
                  </Link>
                </td>
                <td className="p-3">
                  {h.sector17_name && (
                    <Badge variant="outline">{h.sector17_name}</Badge>
                  )}
                </td>
                <td className="p-3 text-right">
                  {h.total_quantity?.toLocaleString()}
                </td>
                <td className="p-3 text-right">
                  ¥{Number(h.avg_cost)?.toLocaleString()}
                </td>
                <td className="p-3 text-right">
                  ¥{Number(h.latest_close)?.toLocaleString()}
                </td>
                <td className={`p-3 text-right ${pnlColor}`}>
                  ¥{Number(h.unrealized_pnl)?.toLocaleString()}
                </td>
                <td className={`p-3 text-right ${pnlColor}`}>
                  {h.unrealized_pnl_pct != null
                    ? `${Number(h.unrealized_pnl_pct) >= 0 ? "+" : ""}${Number(h.unrealized_pnl_pct).toFixed(2)}%`
                    : "-"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function HoldingsTableSkeleton() {
  return (
    <div className="rounded-md border">
      <div className="h-10 border-b bg-muted/50" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4 border-b p-3">
          <div className="h-5 w-24 animate-pulse rounded bg-muted" />
          <div className="h-5 w-16 animate-pulse rounded bg-muted" />
          <div className="ml-auto h-5 w-16 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}
