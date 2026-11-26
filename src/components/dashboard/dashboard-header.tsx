import Link from "next/link";

import { LogoutButton } from "@/components/auth/logout-button";
import { Logo } from "@/components/layout/logo";
import { ROLE_META } from "@/lib/auth/roles";
import type { CurrentUser, Role } from "@/types/entities";

import { HeaderIdentity, MobileNav, type HeaderNavItem } from "./header-islands";

const HOME: Record<Role, HeaderNavItem> = {
  ADMIN: { href: "/admin", label: "Admin overview" },
  FACULTY: { href: "/faculty", label: "Teaching overview" },
  STUDENT: { href: "/student", label: "My overview" },
};

/**
 * Signed-in header, as a Server Component. The role decides the links on the
 * server (the API and role layouts still enforce access), so the shell, logo
 * and links ship as HTML. Only three small islands hydrate: the identity
 * block, the log-out button and the mobile menu.
 */
export function DashboardHeader({ user }: { user: CurrentUser }) {
  const items: HeaderNavItem[] = [HOME[user.role], { href: "/courses", label: "Course catalogue" }];

  return (
    <header className="bg-background/85 sticky top-0 z-40 border-b backdrop-blur-md print:hidden">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Logo />

        <nav aria-label="Portal" className="ml-4 hidden items-center gap-1 md:flex">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/40 rounded-lg px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <HeaderIdentity />
          <LogoutButton />
          <MobileNav items={items} roleLabel={ROLE_META[user.role].label} />
        </div>
      </div>
    </header>
  );
}
