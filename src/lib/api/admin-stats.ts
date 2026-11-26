import "server-only";

import { cache } from "react";

import { serverRequest } from "@/lib/api/server";

export type AdminStats = {
  users: { total: number; byRole: Record<"ADMIN" | "FACULTY" | "STUDENT", number> };
  totalDepartments: number;
  totalCourses: number;
  totalFaculties: number;
  totalStudents: number;
  totalNotices: number;
  activeEnrollments: number;
  pendingPayments: number;
  totalRevenueCollected: number;
  generatedAt: string;
};

/**
 * Dashboard figures, fetched on the server with the visitor's cookies.
 * `cache` dedupes it per request, so the stat grid and the chart card that
 * both need it make one API call.
 */
export const getAdminStats = cache(async (): Promise<AdminStats> => {
  const envelope = await serverRequest<AdminStats>("/admin/dashboard/stats", { forwardCookies: true });
  return envelope.data;
});
