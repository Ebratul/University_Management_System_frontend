"use client";

import Link from "next/link";
import { Menu } from "lucide-react";

import { useSessionSelector } from "@/components/auth/session-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getDisplayName } from "@/lib/auth/user";
import { ROLE_META } from "@/lib/auth/roles";
import { useUiStore } from "@/stores/ui-store";
import type { CurrentUser } from "@/types/entities";

export type HeaderNavItem = { href: string; label: string };

/** Stable, module-level selector: only the fields the header shows. */
const selectIdentity = (user: CurrentUser) => ({ name: getDisplayName(user), role: user.role });

/**
 * Client island: name + role. It subscribes to just these two fields, so it
 * stays live after a profile edit without re-rendering anything else.
 */
export function HeaderIdentity() {
  const { name, role } = useSessionSelector(selectIdentity);
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="hidden items-center gap-3 sm:flex">
      <Avatar className="size-8">
        <AvatarFallback className="bg-brand-gradient text-xs font-semibold text-white">{initials}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="max-w-40 truncate text-sm font-medium">{name}</span>
        <Badge variant="secondary" className="mt-0.5 w-fit text-[10px] uppercase">
          {ROLE_META[role].label}
        </Badge>
      </div>
    </div>
  );
}

const linkClass =
  "text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/40 rounded-lg px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2";

/**
 * Client island: the mobile menu button and its sheet. The open state lives in
 * the Zustand UI store and is read through narrow selectors, so toggling the
 * menu re-renders this island only.
 */
export function MobileNav({ items, roleLabel }: { items: HeaderNavItem[]; roleLabel: string }) {
  const open = useUiStore((state) => state.mobileNavOpen);
  const setOpen = useUiStore((state) => state.setMobileNavOpen);

  return (
    <>
      <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation" onClick={() => setOpen(true)}>
        <Menu className="size-5" aria-hidden="true" />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[min(20rem,calc(100vw-2rem))] gap-0 p-0">
          <SheetHeader className="border-b p-4">
            <SheetTitle>Portal navigation</SheetTitle>
            <SheetDescription>{roleLabel} area</SheetDescription>
          </SheetHeader>
          <nav aria-label="Portal mobile" className="flex flex-col gap-1 p-4">
            {items.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={linkClass}>
                {item.label}
              </Link>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}
