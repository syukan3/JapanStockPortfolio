import { notFound } from "next/navigation";
import {
  getStockMaster,
  getStockPrices,
  getFinancials,
  getEarningsSchedule,
} from "@/lib/queries/stock";
import { CandlestickChartWrapper } from "@/components/stock/candlestick-chart-wrapper";
import { StockFundamentals } from "@/components/stock/stock-fundamentals";
import { EarningsSchedule } from "@/components/stock/earnings-schedule";
import { Badge } from "@/components/ui/badge";

export default async function StockDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  const [master, prices, financials, earnings] = await Promise.all([
    getStockMaster(code),
    getStockPrices(code),
    getFinancials(code),
    getEarningsSchedule(code),
  ]);

  if (!master) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{master.company_name}</h1>
          <span className="font-mono text-lg text-muted-foreground">
            {master.local_code}
          </span>
        </div>
        <div className="mt-1 flex gap-2">
          {master.sector17_name && (
            <Badge variant="outline">{master.sector17_name}</Badge>
          )}
          {master.market_segment && (
            <Badge variant="secondary">{master.market_segment}</Badge>
          )}
        </div>
      </div>

      <CandlestickChartWrapper data={prices} />

      <div className="grid gap-6 md:grid-cols-2">
        <StockFundamentals data={financials} />
        <EarningsSchedule events={earnings} />
      </div>
    </div>
  );
}
