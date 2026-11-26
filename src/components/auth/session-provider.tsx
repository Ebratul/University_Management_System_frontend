"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import { useApiQuery } from "@/hooks/use-api-query";
import { queryKeys } from "@/lib/api/query-keys";
import { usersApi } from "@/lib/api/endpoints";
import type { CurrentUser } from "@/types/entities";

const SESSION_STALE_MS = 5 * 60_000;

/**
 * Holds only the server's snapshot of the user, which never changes for the
 * life of the layout. The live value comes from the TanStack Query cache, so a
 * refetch of /users/me does NOT re-render every context consumer; each
 * component subscribes to exactly what it reads (see useSessionSelector).
 */
const SessionContext = createContext<CurrentUser | null>(null);

/**
 * Makes the signed-in user available to client components. The server layout
 * passes the user in as `initialData`, so the first render needs no request.
 * It is refetched after five minutes, or when the `me` key is invalidated.
 */
export function SessionProvider({ user, children }: { user: CurrentUser; children: ReactNode }) {
  return <SessionContext value={user}>{children}</SessionContext>;
}

function useInitialUser(): CurrentUser {
  const user = useContext(SessionContext);
  if (!user) throw new Error("useSession must be used inside <SessionProvider>.");
  return user;
}

/** The whole current user. Re-renders whenever any field of it changes. */
export function useSession(): CurrentUser {
  const initial = useInitialUser();
  const { data } = useApiQuery({
    queryKey: queryKeys.me,
    queryFn: usersApi.me,
    initialData: initial,
    staleTime: SESSION_STALE_MS,
  });
  return data ?? initial;
}

/**
 * Selective subscription: re-renders only when the selected slice changes
 * (TanStack Query compares the selected value structurally). Pass a stable,
 * module-level selector, e.g. `useSessionSelector(selectRole)`.
 */
export function useSessionSelector<S>(selector: (user: CurrentUser) => S): S {
  const initial = useInitialUser();
  const { data } = useQuery({
    queryKey: queryKeys.me,
    queryFn: usersApi.me,
    initialData: initial,
    staleTime: SESSION_STALE_MS,
    select: selector,
  });
  return data;
}

export const selectRole = (user: CurrentUser) => user.role;
