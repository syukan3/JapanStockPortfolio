"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = [
  "#2563eb", "#dc2626", "#16a34a", "#ca8a04", "#9333ea",
  "#0891b2", "#e11d48", "#65a30d", "#d97706", "#7c3aed",
  "#0d9488", "#f43f5e", "#84cc16", "#f59e0b", "#8b5cf6",
  "#06b6d4", "#f87171",
];

type SectorData = {
  sector17_name: string;
  market_value: number;
  allocation_pct: number;
};

export function AllocationPieChart({ data }: { data: SectorData[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          dataKey="market_value"
          nameKey="sector17_name"
          cx="50%"
          cy="50%"
          outerRadius={100}
          label={({ name, payload }: { name?: string; payload?: SectorData }) =>
            `${name} ${Number(payload?.allocation_pct ?? 0).toFixed(1)}%`
          }
        >
          {data.map((_, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => `¥${Number(value).toLocaleString()}`}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
