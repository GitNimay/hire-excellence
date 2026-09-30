"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, navItems } from "./ui";

/** Vertical rail on sm+, bottom tab bar on phones. Labels show from xl. */
export function Nav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-border bg-background sm:static sm:flex-col sm:justify-start sm:gap-1 sm:border-0">
      {navItems.map(({ slug, label, icon }) => {
        const href = slug ? `/dashboard/${slug}` : "/dashboard";
        const active = pathname === href;
        return (
          <Link
            key={slug}
            href={href}
            aria-current={active ? "page" : undefined}
            title={label}
            className={`flex h-12 flex-1 items-center justify-center gap-3 rounded-md text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-10 sm:flex-none sm:px-3 xl:justify-start ${
              active ? "font-medium text-foreground sm:bg-surface" : "text-muted hover:bg-surface hover:text-foreground"
            }`}
          >
            <Icon d={icon} />
            <span className="hidden xl:inline">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
