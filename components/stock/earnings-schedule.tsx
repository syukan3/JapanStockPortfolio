import type { EarningsEvent } from "@/lib/queries/stock";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function EarningsSchedule({ events }: { events: EarningsEvent[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">決算発表予定</CardTitle>
      </CardHeader>
      <CardContent>
        {!events.length ? (
          <p className="text-sm text-muted-foreground">
            予定されている決算発表はありません
          </p>
        ) : (
          <ul className="space-y-2">
            {events.map((e, i) => (
              <li key={i} className="flex justify-between text-sm">
                <span>{e.announcement_date}</span>
                {e.fiscal_year_end && (
                  <span className="text-muted-foreground">
                    {e.fiscal_year_end}期
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
