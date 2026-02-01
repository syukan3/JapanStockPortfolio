import type { FinancialData } from "@/lib/queries/stock";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function fmt(value: number | null, suffix = "") {
  if (value == null) return "-";
  return `${value.toFixed(2)}${suffix}`;
}

export function StockFundamentals({
  data,
}: {
  data: FinancialData | null;
}) {
  const items = [
    { label: "PER", value: fmt(data?.per ?? null, "倍") },
    { label: "PBR", value: fmt(data?.pbr ?? null, "倍") },
    { label: "ROE", value: fmt(data?.roe ?? null, "%") },
    { label: "配当利回り", value: fmt(data?.dividend_yield ?? null, "%") },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">基本指標</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {items.map((item) => (
            <div key={item.label}>
              <p className="text-sm text-muted-foreground">{item.label}</p>
              <p className="text-lg font-semibold">{item.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
