"use client";

import type { ReactNode } from "react";

import { selectRole, useSessionSelector } from "@/components/auth/session-provider";
import type { Role } from "@/types/entities";

/**
 * Renders children only for the listed roles. This controls what the UI shows.
 * It is not a security boundary: the API and the role layouts enforce access.
 */
export function RoleGate({
  roles,
  children,
  fallback = null,
}: {
  roles: Role[];
  children: ReactNode;
  fallback?: ReactNode;
}) {
  // Subscribes to the role only: a profile edit (name, photo) does not re-render gated UI.
  const role = useSessionSelector(selectRole);
  return roles.includes(role) ? children : fallback;
}
