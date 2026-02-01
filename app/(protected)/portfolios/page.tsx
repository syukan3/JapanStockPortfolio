import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase/server";
import { PortfolioFormDialog } from "@/components/portfolio/portfolio-form";
import { accountTypeLabels } from "@/lib/validations/portfolio";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function PortfoliosPage() {
  const supabase = await getSupabaseServer();
  const { data: portfolios } = await supabase
    .schema("portfolio")
    .from("portfolios")
    .select("id, name, account_type, description")
    .order("created_at", { ascending: true });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">ポートフォリオ</h1>
        <PortfolioFormDialog
          trigger={<Button>新規作成</Button>}
        />
      </div>

      {!portfolios?.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            ポートフォリオがありません。「新規作成」から作成してください。
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {portfolios.map((p) => (
            <Link key={p.id} href={`/portfolios/${p.id}`}>
              <Card className="transition-colors hover:bg-accent/50">
                <CardHeader>
                  <CardTitle className="text-lg">{p.name}</CardTitle>
                  {p.account_type && (
                    <CardDescription>
                      {accountTypeLabels[p.account_type] ?? p.account_type}
                    </CardDescription>
                  )}
                </CardHeader>
                {p.description && (
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {p.description}
                    </p>
                  </CardContent>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
