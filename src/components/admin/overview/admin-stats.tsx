import { BadgeDollarSign, Bell, BookOpen, Building2, CalendarClock, CreditCard, GraduationCap, Users, type LucideIcon } from "lucide-react";

import { StatCard, StatCardSkeleton, type StatTone } from "@/components/shared/stat-card";
import { LocalTime } from "@/components/shared/local-time";
import { getAdminStats } from "@/lib/api/admin-stats";
import { ApiError } from "@/lib/api/errors";

import { RetryButton } from "./retry-button";

const money = new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT", maximumFractionDigits: 0 });
const count = new Intl.NumberFormat("en-US");

const GRID = "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6";

/**
 * Server Component: the figures are fetched on the server and streamed in
 * behind a Suspense boundary, so they arrive with the HTML instead of after
 * hydration + a client request. Ships no JavaScript of its own.
 */
export async function AdminStats() {
  let stats;
  try {
    stats = await getAdminStats();
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "The figures could not be loaded.";
    return (
      <div role="alert" className="bg-destructive/10 text-destructive rounded-2xl p-4 text-sm">
        {message} <RetryButton />
      </div>
    );
  }

  const cards: { label: string; value: string; hint: string; icon: LucideIcon; tone: StatTone }[] = [
    { label: "Students", value: count.format(stats.totalStudents), hint: `${stats.users.byRole.STUDENT} student accounts`, icon: GraduationCap, tone: "teal" },
    { label: "Faculty", value: count.format(stats.totalFaculties), hint: `${stats.users.byRole.FACULTY} faculty accounts`, icon: Users, tone: "violet" },
    { label: "Departments", value: count.format(stats.totalDepartments), hint: "Academic units", icon: Building2, tone: "indigo" },
    { label: "Courses", value: count.format(stats.totalCourses), hint: "In the catalogue", icon: BookOpen, tone: "sky" },
    { label: "Active enrolments", value: count.format(stats.activeEnrollments), hint: "Currently enrolled", icon: CalendarClock, tone: "amber" },
    { label: "Pending payments", value: count.format(stats.pendingPayments), hint: "Awaiting confirmation", icon: CreditCard, tone: "rose" },
    { label: "Revenue collected", value: money.format(stats.totalRevenueCollected), hint: "Paid fees, all semesters", icon: BadgeDollarSign, tone: "teal" },
    { label: "Notices", value: count.format(stats.totalNotices), hint: "Published announcements", icon: Bell, tone: "indigo" },
  ];

  return (
    <div className={GRID}>
      {cards.map((card) => (
        <StatCard key={card.label} {...card} />
      ))}
    </div>
  );
}

/** "Updated 7:38 PM" next to the section heading. Reads the same request-cached stats. */
export async function AdminStatsUpdated() {
  const stats = await getAdminStats().catch(() => null);
  if (!stats) return null;
  return (
    <p className="text-muted-foreground text-xs">
      Updated <LocalTime iso={stats.generatedAt} />
    </p>
  );
}

/** Same grid and card size as the loaded state (zero layout shift). */
export function AdminStatsSkeleton() {
  return (
    <div className={GRID} role="status" aria-label="Loading figures">
      {Array.from({ length: 8 }, (_, index) => (
        <StatCardSkeleton key={index} />
      ))}
    </div>
  );
}
