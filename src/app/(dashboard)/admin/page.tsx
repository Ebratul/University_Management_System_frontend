import type { Metadata } from "next";
import { Suspense } from "react";

import { AdminInsights } from "@/components/admin/overview/admin-insights";
import { AdminShortcuts } from "@/components/admin/overview/admin-shortcuts";
import { AdminStats, AdminStatsSkeleton, AdminStatsUpdated } from "@/components/admin/overview/admin-stats";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = {
  title: "Administration",
};

/**
 * Server Component. The header and shortcuts are sent immediately; the figures
 * stream in when the API answers (Suspense), and only the charts hydrate.
 */
export default function AdminHomePage() {
  return (
    <div className="space-y-8 lg:space-y-12">
      <PageHeader eyebrow="Administration" title="University overview" highlight="overview" description="Live figures for the whole university, and shortcuts to every admin area." />

      <section aria-labelledby="stats-heading" className="space-y-4">
        <div className="flex h-7 items-end justify-between gap-4">
          <h2 id="stats-heading" className="text-xl font-semibold tracking-[-0.02em]">
            At a glance
          </h2>
          <Suspense fallback={null}>
            <AdminStatsUpdated />
          </Suspense>
        </div>
        <Suspense fallback={<AdminStatsSkeleton />}>
          <AdminStats />
        </Suspense>
      </section>

      <section aria-labelledby="areas-heading" className="space-y-4">
        <h2 id="areas-heading" className="text-xl font-semibold tracking-[-0.02em]">
          Manage
        </h2>
        <AdminShortcuts />
      </section>

      <AdminInsights />
    </div>
  );
}
