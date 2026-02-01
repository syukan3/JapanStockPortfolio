import { getSupabaseServer } from "@/lib/supabase/server";
import { TransactionForm } from "@/components/transaction/transaction-form";

export default async function NewTransactionPage({
  searchParams,
}: {
  searchParams: Promise<{ portfolio_id?: string }>;
}) {
  const { portfolio_id } = await searchParams;
  const supabase = await getSupabaseServer();
  const { data: portfolios } = await supabase
    .schema("portfolio")
    .from("portfolios")
    .select("id, name")
    .order("created_at", { ascending: true });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">取引登録</h1>
      <TransactionForm
        portfolios={portfolios ?? []}
        defaultPortfolioId={portfolio_id}
      />
    </div>
  );
}
