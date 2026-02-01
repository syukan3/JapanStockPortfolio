"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const CandlestickChart = dynamic(
  () =>
    import("@/components/stock/candlestick-chart").then(
      (mod) => mod.CandlestickChart
    ),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[400px] w-full" />,
  }
);

type PriceData = {
  trade_date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export function CandlestickChartWrapper({ data }: { data: PriceData[] }) {
  return <CandlestickChart data={data} />;
}
