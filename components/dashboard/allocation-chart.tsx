"use client";

import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const PieChartComponent = dynamic(
  () =>
    import("./allocation-pie-chart").then((mod) => mod.AllocationPieChart),
  { ssr: false, loading: () => <AllocationChartSkeleton /> }
);

type SectorData = {
  sector17_name: string;
  market_value: number;
  allocation_pct: number;
};

export function AllocationChartClient({ data }: { data: SectorData[] }) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">セクター別配分</CardTitle>
        </CardHeader>
        <CardContent className="text-center text-muted-foreground py-8">
          保有銘柄がありません
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">セクター別配分</CardTitle>
      </CardHeader>
      <CardContent>
        <PieChartComponent data={data} />
      </CardContent>
    </Card>
  );
}

export function AllocationChartSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">セクター別配分</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mx-auto h-64 w-64 animate-pulse rounded-full bg-muted" />
      </CardContent>
    </Card>
  );
}
