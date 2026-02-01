import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getDefaultPortfolioId } from "@/lib/queries/user-settings";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { PortfolioProvider } from "@/components/layout/portfolio-context";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const defaultPortfolioId = await getDefaultPortfolioId();

  return (
    <PortfolioProvider defaultPortfolioId={defaultPortfolioId}>
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header email={user.email ?? ""} />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </PortfolioProvider>
  );
}
