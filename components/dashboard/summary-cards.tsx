import { getPortfolioSummary } from "@/lib/queries/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function formatCurrency(value: number | null) {
  if (value == null) return "¥0";
  return `¥${value.toLocaleString()}`;
}

function formatPercent(value: number | null) {
  if (value == null) return "0%";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export async function SummaryCards({
  portfolioId,
}: {
  portfolioId: string;
}) {
  const summary = await getPortfolioSummary(portfolioId);

  if (!summary) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {["総資産評価額", "総投資額", "含み損益", "日次変動"].map((title) => (
          <Card key={title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">-</p>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: "総資産評価額",
      value: formatCurrency(summary.total_market_value),
    },
    {
      title: "総投資額",
      value: formatCurrency(summary.total_cost),
    },
    {
      title: "含み損益",
      value: formatCurrency(summary.unrealized_pnl),
      sub: formatPercent(summary.unrealized_pnl_pct),
      color: (summary.unrealized_pnl ?? 0) >= 0 ? "text-green-600" : "text-red-600",
    },
    {
      title: "日次変動",
      value: formatCurrency(summary.daily_change),
      sub: formatPercent(summary.daily_change_pct),
      color: (summary.daily_change ?? 0) >= 0 ? "text-green-600" : "text-red-600",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${card.color ?? ""}`}>
              {card.value}
            </p>
            {card.sub && (
              <p className={`text-sm ${card.color ?? ""}`}>{card.sub}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function SummaryCardsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <div className="h-4 w-20 animate-pulse rounded bg-muted" />
          </CardHeader>
          <CardContent>
            <div className="h-8 w-32 animate-pulse rounded bg-muted" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
