"use client";

import { useActionState } from "react";
import Link from "next/link";
import { resetPassword, type AuthActionState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ResetPasswordPage() {
  const [state, formAction, isPending] = useActionState<AuthActionState, FormData>(
    resetPassword,
    {}
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>パスワードリセット</CardTitle>
        <CardDescription>
          登録メールアドレスにリセットリンクを送信します
        </CardDescription>
      </CardHeader>
      <form action={formAction}>
        <CardContent className="space-y-4">
          {state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
          {state.success && (
            <p className="text-sm text-green-600">{state.success}</p>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">メールアドレス</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "送信中..." : "リセットメールを送信"}
          </Button>
          <Link
            href="/login"
            className="text-sm text-muted-foreground hover:underline"
          >
            ログインに戻る
          </Link>
        </CardFooter>
      </form>
    </Card>
  );
}
