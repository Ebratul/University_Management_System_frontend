import { Suspense } from "react";

import { RolesDonut, SeatBars } from "@/components/admin/admin-charts-lazy";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminStats } from "@/lib/api/admin-stats";

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** Reads the same (request-cached) stats as the grid; the chart itself is a lazy client island. */
async function RolesChart() {
  const stats = await getAdminStats().catch(() => null);
  if (!stats) return <p className="text-muted-foreground flex h-64 items-center justify-center text-sm">Figures unavailable.</p>;
  return <RolesDonut byRole={stats.users.byRole} />;
}

export function AdminInsights() {
  return (
    <section aria-labelledby="insights-heading" className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
      <h2 id="insights-heading" className="sr-only">
        Insights
      </h2>
      <ChartCard title="Accounts by role">
        <Suspense fallback={<div className="skeleton-shimmer h-64 w-full rounded-xl" aria-hidden="true" />}>
          <RolesChart />
        </Suspense>
      </ChartCard>
      <ChartCard title="Seat use, largest offerings">
        <SeatBars />
      </ChartCard>
    </section>
  );
}
