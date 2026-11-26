/**
 * Seeded sample records for exercising the large-list views (virtualization,
 * client-side filtering) when the real database is small.
 *
 * - Deterministic: the same seed always yields the same rows, so profiling runs
 *   are comparable.
 * - Never sent to the API and never saved. The UI labels it "Sample data".
 * - Imported only with dynamic import(), so it is a separate chunk that the
 *   normal pages never download. A hand-rolled PRNG instead of @faker-js/faker
 *   keeps that chunk at a few KB rather than ~1 MB.
 */
import type { AdminUser, AuditLog, Role } from "@/types/entities";

export const SAMPLE_SIZE = 5_000;

/** mulberry32: tiny, fast, good enough for fixtures. */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ["Ayesha", "Rahim", "Nusrat", "Tanvir", "Farhana", "Imran", "Sadia", "Arif", "Maliha", "Kamal", "Tasnim", "Rafi", "Jannat", "Sabbir", "Lamia", "Hasan", "Mim", "Shakil", "Anika", "Fahim"];
const LAST = ["Rahman", "Hossain", "Ahmed", "Islam", "Chowdhury", "Khan", "Akter", "Uddin", "Karim", "Sarker", "Biswas", "Das", "Saha", "Roy", "Haque"];
const ACTIONS = ["LOGIN", "LOGOUT", "USER_CREATED", "USER_ROLE_CHANGED", "COURSE_CREATED", "COURSE_UPDATED", "OFFERING_CREATED", "ENROLLMENT_CREATED", "ENROLLMENT_DROPPED", "RESULT_PUBLISHED", "PAYMENT_INITIATED", "PAYMENT_COMPLETED", "NOTICE_PUBLISHED", "REGISTRATION_SUBMITTED"];
const ENTITY: Record<string, string> = {
  LOGIN: "User", LOGOUT: "User", USER_CREATED: "User", USER_ROLE_CHANGED: "User",
  COURSE_CREATED: "Course", COURSE_UPDATED: "Course", OFFERING_CREATED: "CourseOffering",
  ENROLLMENT_CREATED: "Enrollment", ENROLLMENT_DROPPED: "Enrollment", RESULT_PUBLISHED: "Result",
  PAYMENT_INITIATED: "Payment", PAYMENT_COMPLETED: "Payment", NOTICE_PUBLISHED: "Notice", REGISTRATION_SUBMITTED: "Registration",
};
const ROLES: Role[] = ["STUDENT", "STUDENT", "STUDENT", "STUDENT", "FACULTY", "ADMIN"];
const START = Date.UTC(2025, 0, 1);
const SPAN = Date.UTC(2026, 10, 1) - START;

const pick = <T,>(rand: () => number, list: readonly T[]) => list[Math.floor(rand() * list.length)];
const id = (prefix: string, n: number) => `sample-${prefix}-${n.toString(36).padStart(5, "0")}`;

export function sampleUsers(count = SAMPLE_SIZE, seed = 42): AdminUser[] {
  const rand = prng(seed);
  return Array.from({ length: count }, (_, i) => {
    const name = `${pick(rand, FIRST)} ${pick(rand, LAST)}`;
    const role = pick(rand, ROLES);
    const email = `${name.toLowerCase().replace(" ", ".")}${i}@sample.university.local`;
    const profileId = id("p", i);
    return {
      id: id("u", i),
      email,
      role,
      isActive: rand() > 0.08,
      imageUrl: "",
      createdAt: new Date(START + Math.floor(rand() * SPAN)).toISOString(),
      admin: role === "ADMIN" ? { id: profileId, name } : null,
      faculty: role === "FACULTY" ? { id: profileId, name, facultyId: `F-${1000 + i}` } : null,
      student: role === "STUDENT" ? { id: profileId, name, studentId: `S-${20000 + i}` } : null,
    };
  });
}

export function sampleAuditLogs(count = SAMPLE_SIZE, seed = 7): AuditLog[] {
  const rand = prng(seed);
  const rows = Array.from({ length: count }, (_, i): AuditLog => {
    const action = pick(rand, ACTIONS);
    const role = pick(rand, ROLES);
    const who = `${pick(rand, FIRST).toLowerCase()}.${pick(rand, LAST).toLowerCase()}@sample.university.local`;
    return {
      id: id("a", i),
      action,
      entityType: ENTITY[action],
      entityId: id("e", Math.floor(rand() * 900)),
      performedByUserId: id("u", Math.floor(rand() * 900)),
      performedByEmail: action === "PAYMENT_COMPLETED" && rand() > 0.7 ? null : who,
      performedByRole: role,
      description: `${action.replaceAll("_", " ").toLowerCase()} (sample #${i + 1})`,
      metadata: null,
      ipAddress: `10.0.${Math.floor(rand() * 255)}.${Math.floor(rand() * 255)}`,
      createdAt: new Date(START + Math.floor(rand() * SPAN)).toISOString(),
    };
  });
  return rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
