// @vitest-environment happy-dom
import { act, Profiler } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, test } from "vitest";

import { queryKeys } from "@/lib/api/query-keys";
import type { CurrentUser } from "@/types/entities";

import { selectRole, SessionProvider, useSession, useSessionSelector } from "./session-provider";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const user = { id: "u1", email: "a@b.c", role: "STUDENT", isActive: true, imageUrl: "", student: { name: "Ayesha Rahman" } } as unknown as CurrentUser;

const renders = { role: 0, full: 0 };

function RoleOnly() {
  return <span>{useSessionSelector(selectRole)}</span>;
}

function FullUser() {
  return <span>{useSession().email}</span>;
}

/** React's own <Profiler> reports every commit of its subtree, i.e. every time the component rendered. */
const count = (key: keyof typeof renders) => () => {
  renders[key]++;
};

/** TanStack Query batches observer notifications on a timeout; let it flush inside act. */
async function update(client: QueryClient, next: CurrentUser) {
  await act(async () => {
    client.setQueryData(queryKeys.me, next);
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

let cleanup: (() => void) | undefined;
afterEach(() => cleanup?.());

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const container = document.createElement("div");
  const root = createRoot(container);
  act(() =>
    root.render(
      <QueryClientProvider client={client}>
        <SessionProvider user={user}>
          <Profiler id="role" onRender={count("role")}>
            <RoleOnly />
          </Profiler>
          <Profiler id="full" onRender={count("full")}>
            <FullUser />
          </Profiler>
        </SessionProvider>
      </QueryClientProvider>,
    ),
  );
  cleanup = () => act(() => root.unmount());
  return { client, container };
}

describe("session selective subscriptions", () => {
  test("a role subscriber does not re-render when another field of the user changes", async () => {
    renders.role = 0;
    renders.full = 0;
    const { client } = mount();
    expect(renders).toEqual({ role: 1, full: 1 });

    // e.g. the profile form saved a new email / photo and /users/me refetched
    await update(client, { ...user, email: "new@b.c" });
    expect(renders.full).toBe(2);
    expect(renders.role).toBe(1);
  });

  test("the role subscriber does re-render when the role itself changes", async () => {
    renders.role = 0;
    renders.full = 0;
    const { client, container } = mount();
    await update(client, { ...user, role: "ADMIN" } as CurrentUser);
    expect(renders.role).toBe(2);
    expect(container.textContent).toContain("ADMIN");
  });
});
