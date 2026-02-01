"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function ProtectedErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // 403 の場合はログアウト
    if (error.message.includes("403") || error.message.includes("Forbidden")) {
      router.push("/login");
    }
  }, [error, router]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <h1 className="text-2xl font-bold">エラーが発生しました</h1>
      <p className="text-muted-foreground">{error.message}</p>
      <div className="flex gap-2">
        <Button onClick={reset}>再試行</Button>
        <Button variant="outline" onClick={() => router.push("/login")}>
          ログインへ
        </Button>
      </div>
    </div>
  );
}
