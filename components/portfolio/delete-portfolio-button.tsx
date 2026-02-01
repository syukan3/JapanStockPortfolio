"use client";

import { useRouter } from "next/navigation";
import { deletePortfolio } from "@/lib/actions/portfolio";
import { Button } from "@/components/ui/button";

export function DeletePortfolioButton({
  portfolioId,
}: {
  portfolioId: string;
}) {
  const router = useRouter();

  async function handleDelete() {
    if (!confirm("このポートフォリオを削除しますか？関連する取引もすべて削除されます。")) {
      return;
    }

    const result = await deletePortfolio(portfolioId);
    if (result.error) {
      alert(result.error);
    } else {
      router.push("/portfolios");
    }
  }

  return (
    <Button variant="destructive" onClick={handleDelete}>
      削除
    </Button>
  );
}
