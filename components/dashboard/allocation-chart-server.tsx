import { getSectorAllocation } from "@/lib/queries/dashboard";
import { AllocationChartClient } from "./allocation-chart";

export async function AllocationChart({
  portfolioId,
}: {
  portfolioId: string;
}) {
  const data = await getSectorAllocation(portfolioId);
  return <AllocationChartClient data={data} />;
}
