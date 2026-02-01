import { Suspense } from "react";
import Link from "next/link";
import { getDefaultPortfolioId } from "@/lib/queries/user-settings";
import {
  SummaryCards,
  SummaryCardsSkeleton,
} from "@/components/dashboard/summary-cards";
import {
  HoldingsTable,
  HoldingsTableSkeleton,
} from "@/components/dashboard/holdings-table";
import { AllocationChart } from "@/components/dashboard/allocation-chart-server";
import { AllocationChartSkeleton } from "@/components/dashboard/allocation-chart";
import { Button } from "@/components/ui/button";

export default async function DashboardPage() {
  const portfolioId = await getDefaultPortfolioId();

  if (!portfolioId) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <h1 className="text-2xl font-bold">ダッシュボード</h1>
        <p className="text-muted-foreground">
          ポートフォリオを作成して取引を登録しましょう。
        </p>
        <Button asChild>
          <Link href="/portfolios">ポートフォリオを作成</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">ダッシュボード</h1>

      <Suspense fallback={<SummaryCardsSkeleton />}>
        <SummaryCards portfolioId={portfolioId} />
      </Suspense>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-4 text-lg font-semibold">保有銘柄</h2>
          <Suspense fallback={<HoldingsTableSkeleton />}>
            <HoldingsTable portfolioId={portfolioId} />
          </Suspense>
        </div>
        <div>
          <Suspense fallback={<AllocationChartSkeleton />}>
            <AllocationChart portfolioId={portfolioId} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
