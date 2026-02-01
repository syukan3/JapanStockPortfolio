"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";

type StockItem = {
  local_code: string;
  company_name: string;
};

const fetcher = async (): Promise<StockItem[]> => {
  const supabase = getSupabaseBrowser();
  const { data } = await supabase
    .from("equity_master")
    .select("local_code, company_name")
    .eq("is_current", true)
    .order("local_code");
  return data ?? [];
};

export function StockAutocomplete({
  value,
  onChange,
}: {
  value: string;
  onChange: (code: string, name: string) => void;
}) {
  const [query, setQuery] = useState(value);
  const [isOpen, setIsOpen] = useState(false);

  const { data: stocks } = useSWR("equity_master", fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    dedupingInterval: 86400000,
  });

  const filtered = useCallback(() => {
    if (!stocks || !query) return [];
    const q = query.toLowerCase();
    return stocks
      .filter(
        (s) =>
          s.local_code.includes(q) || s.company_name.toLowerCase().includes(q)
      )
      .slice(0, 10);
  }, [stocks, query]);

  return (
    <div className="relative">
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        placeholder="銘柄コードまたは銘柄名"
      />
      <input type="hidden" name="local_code" value={value} />
      {isOpen && filtered().length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md">
          {filtered().map((s) => (
            <li
              key={s.local_code}
              className="cursor-pointer rounded-sm px-3 py-2 text-sm hover:bg-accent"
              onMouseDown={() => {
                onChange(s.local_code, s.company_name);
                setQuery(`${s.local_code} ${s.company_name}`);
                setIsOpen(false);
              }}
            >
              <span className="font-mono">{s.local_code}</span>{" "}
              {s.company_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
