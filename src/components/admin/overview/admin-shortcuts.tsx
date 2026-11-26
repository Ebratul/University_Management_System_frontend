import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { ADMIN_NAV } from "@/lib/auth/nav";

/** Static links to every admin area. A Server Component: plain HTML, no JS. */
export function AdminShortcuts() {
  const shortcuts = ADMIN_NAV.filter((item) => item.href !== "/admin");
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6 xl:grid-cols-4">
      {shortcuts.map((item) => (
        <li key={item.href}>
          <Link
            href={item.href}
            className="bg-card card-hover shadow-card focus-visible:ring-ring/40 group flex h-14 items-center justify-between rounded-2xl border px-5 font-medium outline-none focus-visible:ring-2"
          >
            {item.label}
            <ArrowUpRight className="text-muted-foreground group-hover:text-primary size-4 transition-colors" aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
