"use client";

import { useActionState, useState } from "react";
import {
  createTransaction,
  type TransactionActionState,
} from "@/lib/actions/transaction";
import { StockAutocomplete } from "./stock-autocomplete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
};

export function TransactionForm({
  portfolios,
  defaultPortfolioId,
}: {
  portfolios: Portfolio[];
  defaultPortfolioId?: string;
}) {
  const [state, formAction, isPending] = useActionState<
    TransactionActionState,
    FormData
  >(createTransaction, {});
  const [localCode, setLocalCode] = useState("");

  const today = new Date().toISOString().split("T")[0];

  return (
    <form action={formAction} className="space-y-4 max-w-lg">
      {state.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <div className="space-y-2">
        <Label>ポートフォリオ</Label>
        <Select name="portfolio_id" defaultValue={defaultPortfolioId}>
          <SelectTrigger>
            <SelectValue placeholder="選択してください" />
          </SelectTrigger>
          <SelectContent>
            {portfolios.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>銘柄</Label>
        <StockAutocomplete
          value={localCode}
          onChange={(code) => setLocalCode(code)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>売買種別</Label>
          <Select name="trade_type" defaultValue="buy">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="buy">買い</SelectItem>
              <SelectItem value="sell">売り</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="trade_date">約定日</Label>
          <Input
            id="trade_date"
            name="trade_date"
            type="date"
            required
            defaultValue={today}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="quantity">数量（株）</Label>
          <Input
            id="quantity"
            name="quantity"
            type="number"
            required
            min={1}
            step={1}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="unit_price">約定単価（円）</Label>
          <Input
            id="unit_price"
            name="unit_price"
            type="number"
            required
            min={0}
            step={0.01}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="commission">手数料（円）</Label>
          <Input
            id="commission"
            name="commission"
            type="number"
            defaultValue={0}
            min={0}
            step={0.01}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tax">税金（円）</Label>
          <Input
            id="tax"
            name="tax"
            type="number"
            defaultValue={0}
            min={0}
            step={0.01}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">メモ</Label>
        <Input id="notes" name="notes" />
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "登録中..." : "取引を登録"}
      </Button>
    </form>
  );
}
