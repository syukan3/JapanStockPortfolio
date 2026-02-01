"use client";

import { useActionState } from "react";
import {
  createPortfolio,
  updatePortfolio,
  type PortfolioActionState,
} from "@/lib/actions/portfolio";
import { accountTypeLabels } from "@/lib/validations/portfolio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Portfolio = {
  id: string;
  name: string;
  account_type: string | null;
  description: string | null;
};

export function PortfolioFormDialog({
  portfolio,
  trigger,
}: {
  portfolio?: Portfolio;
  trigger: React.ReactNode;
}) {
  const isEdit = !!portfolio;

  const action = isEdit
    ? updatePortfolio.bind(null, portfolio.id)
    : createPortfolio;

  const [state, formAction, isPending] = useActionState<
    PortfolioActionState,
    FormData
  >(action, {});

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "ポートフォリオ編集" : "ポートフォリオ作成"}
          </DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
          <div className="space-y-2">
            <Label htmlFor="name">ポートフォリオ名</Label>
            <Input
              id="name"
              name="name"
              required
              defaultValue={portfolio?.name}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="account_type">口座種別</Label>
            <Select
              name="account_type"
              defaultValue={portfolio?.account_type ?? undefined}
            >
              <SelectTrigger>
                <SelectValue placeholder="選択してください" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(accountTypeLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">メモ</Label>
            <Input
              id="description"
              name="description"
              defaultValue={portfolio?.description ?? ""}
            />
          </div>
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "保存中..." : isEdit ? "更新" : "作成"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
